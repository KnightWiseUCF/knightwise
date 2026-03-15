import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Bold, Code, FileCode, GripVertical, Italic, List, ListOrdered, Pilcrow, Trash2, Underline } from "lucide-react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { isAxiosError } from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api";
import { RawQuestion } from "../models";

interface DraftAnswer {
  id: string;
  text: string;
  isCorrect: boolean;
  rank: number;
  placement: string;
}

interface QuestionDraft {
  id: string;
  title: string;
  section: string;
  category: string;
  subcategory: string;
  questionType: string;
  questionText: string;
  answers: DraftAnswer[];
  dropSections: string[];
  updatedAt: string;
  publishedQuestionId?: number;
}

interface PublishedQuestion {
  id: number;
  section: string;
  category: string;
  subcategory: string;
  questionType: string;
  authorExamId: string;
  ownerId: number;
}

interface DraftListResponse {
  drafts?: RawQuestion[];
}

const DRAFTS_STORAGE_KEY = "prof_question_drafts";

const topicCategoryMap: Record<string, string[]> = {
  "Introductory Programming": ["Input/Output", "Branching", "Loops", "Variables"],
  "Simple Data Structures": ["Arrays", "Linked Lists", "Strings"],
  "Object Oriented Programming": ["Classes", "Methods"],
  "Intermediate Data Structures": ["Trees", "Stacks"],
  "Complex Data Structures": ["Heaps", "Tries"],
  "Intermediate Programming": ["Bitwise Operators", "Dynamic Memory", "Algorithm Analysis", "Recursion", "Sorting"],
};

const defaultSections = ["A", "B", "C", "D"];

const defaultSubcategories = Object.values(topicCategoryMap).flat();

const defaultCategories = Object.keys(topicCategoryMap);

const questionTypeOptions = [
  "Multiple Choice",
  "Fill in the Blanks",
  "Select All That Apply",
  "Ranked Choice",
  "Drag and Drop",
];

const createEmptyAnswer = (index: number): DraftAnswer => ({
  id: crypto.randomUUID(),
  text: "",
  isCorrect: index === 0,
  rank: index + 1,
  placement: "",
});

const createDefaultAnswers = (): DraftAnswer[] => [createEmptyAnswer(0), createEmptyAnswer(1)];
const createDefaultDropSections = (): string[] => ["Section 1", "Section 2"];

const syncAnswerRanks = (answers: DraftAnswer[]): DraftAnswer[] =>
  answers.map((answer, index) => ({
    ...answer,
    rank: index + 1,
  }));

const buildDeleteErrorMessage = (
  err: unknown,
  fallbackMessage: string,
  context: "draft" | "published"
): string => {
  if (isAxiosError(err)) {
    const statusCode = err.response?.status;
    const responseMessage = err.response?.data && typeof err.response.data === "object"
      ? (err.response.data as { message?: unknown }).message
      : undefined;
    const normalizedResponseMessage = typeof responseMessage === "string" ? responseMessage : "";

    console.error(`[ProfessorDraftsPage] Failed to delete ${context} question`, {
      statusCode,
      responseData: err.response?.data,
      requestUrl: err.config?.url,
      requestMethod: err.config?.method,
    });

    if (statusCode) {
      return normalizedResponseMessage
        ? `${fallbackMessage} (HTTP ${statusCode}: ${normalizedResponseMessage})`
        : `${fallbackMessage} (HTTP ${statusCode})`;
    }

    if (normalizedResponseMessage) {
      return `${fallbackMessage} (${normalizedResponseMessage})`;
    }
  }

  return fallbackMessage;
};

const normalizeQuestionType = (questionType?: string): string => {
  const normalized = (questionType || "").trim();
  if (questionTypeOptions.includes(normalized)) {
    return normalized;
  }

  switch (normalized.toLowerCase()) {
    case "multiple_choice":
      return "Multiple Choice";
    case "fill_in_blank":
      return "Fill in the Blanks";
    case "select_all_that_apply":
      return "Select All That Apply";
    case "ranked_choice":
      return "Ranked Choice";
    case "drag_and_drop":
      return "Drag and Drop";
    default:
      return "Multiple Choice";
  }
};

const parseAnswerCorrectness = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }

  return false;
};

const buildDraftFromPublishedQuestion = (
  question: RawQuestion,
  existingDraft?: QuestionDraft
): QuestionDraft => {
  const questionType = normalizeQuestionType(question.TYPE);
  const normalizedAnswers = (question.answers || []).map((answer, index) => {
    const parsedRank = Number(answer.RANK);

    return {
      id: crypto.randomUUID(),
      text: String(answer.TEXT || ""),
      isCorrect:
        questionType === "Ranked Choice" || questionType === "Drag and Drop"
          ? true
          : parseAnswerCorrectness(answer.IS_CORRECT_ANSWER),
      rank: Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : index + 1,
      placement: String(answer.PLACEMENT || "").trim(),
    };
  });

  const answers = normalizedAnswers.length > 0
    ? syncAnswerRanks(normalizedAnswers)
    : createDefaultAnswers();

  const dropSections = Array.from(
    new Set(
      answers
        .map((answer) => answer.placement.trim())
        .filter(Boolean)
    )
  );

  const fallbackTitle = `${question.CATEGORY || "Question"} #${question.ID}`;
  const parsedExistingDraftId = Number(existingDraft?.id);
  const linkedDraftId = Number.isFinite(parsedExistingDraftId) && parsedExistingDraftId > 0
    ? String(parsedExistingDraftId)
    : String(question.ID);

  return {
    id: linkedDraftId,
    title: existingDraft?.title || fallbackTitle,
    section: String(question.SECTION || ""),
    category: String(question.CATEGORY || ""),
    subcategory: String(question.SUBCATEGORY || ""),
    questionType,
    questionText: String(question.QUESTION_TEXT || ""),
    answers,
    dropSections: dropSections.length > 0 ? dropSections : createDefaultDropSections(),
    updatedAt: new Date().toISOString(),
    publishedQuestionId: question.ID,
  };
};

const loadDrafts = (): QuestionDraft[] => {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const safeAnswers = Array.isArray((item as { answers?: unknown[] }).answers)
          ? ((item as { answers?: unknown[] }).answers as unknown[])
              .filter((answer) => answer && typeof answer === "object")
              .map((answer, index) => {
                const typedAnswer = answer as {
                  id?: unknown;
                  text?: unknown;
                  isCorrect?: unknown;
                  rank?: unknown;
                  placement?: unknown;
                };

                return {
                  id: typeof typedAnswer.id === "string" ? typedAnswer.id : crypto.randomUUID(),
                  text: typeof typedAnswer.text === "string" ? typedAnswer.text : "",
                  isCorrect: Boolean(typedAnswer.isCorrect),
                  rank:
                    typeof typedAnswer.rank === "number" && Number.isFinite(typedAnswer.rank)
                      ? typedAnswer.rank
                      : index + 1,
                  placement: typeof typedAnswer.placement === "string" ? typedAnswer.placement : "",
                };
              })
          : [];

        const typedItem = item as {
          id?: unknown;
          title?: unknown;
          section?: unknown;
          category?: unknown;
          subcategory?: unknown;
          questionType?: unknown;
          questionText?: unknown;
                  dropSections?: unknown;
          updatedAt?: unknown;
          publishedQuestionId?: unknown;
        };

        const safeDropSections = Array.isArray(typedItem.dropSections)
          ? typedItem.dropSections
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean)
          : [];

        const parsedDraftId = Number(typedItem.id);
        const parsedPublishedQuestionId =
          typeof typedItem.publishedQuestionId === "number" ? typedItem.publishedQuestionId : undefined;
        const normalizedDraftId =
          Number.isFinite(parsedDraftId) && parsedDraftId > 0
            ? String(parsedDraftId)
            : typeof parsedPublishedQuestionId === "number"
              ? String(parsedPublishedQuestionId)
              : crypto.randomUUID();

        return {
          id: normalizedDraftId,
          title: typeof typedItem.title === "string" ? typedItem.title : "",
          section: typeof typedItem.section === "string" ? typedItem.section : "",
          category: typeof typedItem.category === "string" ? typedItem.category : "",
          subcategory: typeof typedItem.subcategory === "string" ? typedItem.subcategory : "",
          questionType:
            typeof typedItem.questionType === "string" && questionTypeOptions.includes(typedItem.questionType)
              ? typedItem.questionType
              : "Multiple Choice",
          questionText: typeof typedItem.questionText === "string" ? typedItem.questionText : "",
          answers: safeAnswers.length > 0 ? safeAnswers : createDefaultAnswers(),
          dropSections: safeDropSections.length > 0 ? safeDropSections : createDefaultDropSections(),
          updatedAt: typeof typedItem.updatedAt === "string" ? typedItem.updatedAt : new Date().toISOString(),
          publishedQuestionId: parsedPublishedQuestionId,
        } as QuestionDraft;
      });
  } catch {
    return [];
  }
};

const saveDrafts = (drafts: QuestionDraft[]) => {
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
};

const buildDraftFromServerQuestion = (question: RawQuestion): QuestionDraft => {
  const mapped = buildDraftFromPublishedQuestion(question);
  return {
    ...mapped,
    id: String(question.ID),
    title: mapped.title || `${question.CATEGORY || "Question"} #${question.ID}`,
    publishedQuestionId: undefined,
  };
};

const emptyForm = {
  title: "",
  section: "",
  category: "",
  subcategory: "",
  questionType: "Multiple Choice",
  questionText: "",
  answers: createDefaultAnswers(),
  dropSections: createDefaultDropSections(),
};

const ProfessorDraftsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const handledDashboardActionRef = useRef<string | null>(null);
  const accountType = localStorage.getItem("account_type");
  const isProfessor = accountType === "professor";

  const [drafts, setDrafts] = useState<QuestionDraft[]>(() => loadDrafts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [publishingDraftId, setPublishingDraftId] = useState<string | null>(null);
  const [pendingDeleteAnswerId, setPendingDeleteAnswerId] = useState<string | null>(null);
  const [draggedAnswerId, setDraggedAnswerId] = useState<string | null>(null);
  const answerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const answerPositions = useRef<Map<string, DOMRect>>(new Map());
  const [availableSections, setAvailableSections] = useState<string[]>(defaultSections);
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategories);
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>(defaultSubcategories);
  const [showQuestionPreview, setShowQuestionPreview] = useState(false);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeTab, setActiveTab] = useState<"drafts" | "published">("drafts");
  const [publishedQuestions, setPublishedQuestions] = useState<PublishedQuestion[]>([]);
  const [isLoadingPublished, setIsLoadingPublished] = useState(false);
  const [publishedLoadError, setPublishedLoadError] = useState("");
  const [pendingDeletePublishedId, setPendingDeletePublishedId] = useState<number | null>(null);
  const [publishedActionId, setPublishedActionId] = useState<number | null>(null);

  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts]
  );

  const subcategoryOptions = useMemo(() => {
    const selectedCategory = form.category.trim();
    if (selectedCategory && topicCategoryMap[selectedCategory]) {
      return topicCategoryMap[selectedCategory];
    }
    return availableSubcategories;
  }, [form.category, availableSubcategories]);

  const linkedDraftByPublishedId = useMemo(() => {
    const map = new Map<number, QuestionDraft>();
    drafts.forEach((draft) => {
      if (typeof draft.publishedQuestionId === "number") {
        map.set(draft.publishedQuestionId, draft);
      }
    });
    return map;
  }, [drafts]);

  const editingDraft = useMemo(
    () => (editingId ? drafts.find((draft) => draft.id === editingId) ?? null : null),
    [drafts, editingId]
  );

  const questionPreviewHtml = useMemo(
    () => DOMPurify.sanitize(form.questionText),
    [form.questionText]
  );

  useEffect(() => {
    const fetchAvailableQuestionMetadata = async () => {
      try {
        const res = await api.get<{ questions?: Array<{ SECTION?: string; CATEGORY?: string; SUBCATEGORY?: string }> }>("/api/test/mocktest");
        const questions = res.data?.questions || [];

        const sectionsFromApi = questions
          .map((question) => String(question.SECTION || "").trim())
          .filter(Boolean);
        const subcategoriesFromApi = questions
          .map((question) => String(question.SUBCATEGORY || "").trim())
          .filter(Boolean);

        setAvailableSections(Array.from(new Set([...defaultSections, ...sectionsFromApi])));
        const mappedCategoryNames = defaultCategories;
        const mergedSubcategories = Array.from(new Set(subcategoriesFromApi));

        setAvailableCategories(mappedCategoryNames);
        setAvailableSubcategories(mergedSubcategories.length > 0 ? mergedSubcategories : defaultSubcategories);
      } catch {
        setAvailableSections(defaultSections);
        setAvailableCategories(defaultCategories);
        setAvailableSubcategories(defaultSubcategories);
      }
    };

    fetchAvailableQuestionMetadata();
  }, []);

  useEffect(() => {
    const fetchDrafts = async () => {
      if (!isProfessor || activeTab !== "drafts") {
        return;
      }

      try {
        const res = await api.get<DraftListResponse>("/api/admin/drafts");
        const draftMetadata = Array.isArray(res.data?.drafts) ? res.data.drafts : [];

        const detailResults = await Promise.allSettled(
          draftMetadata.map((draft) => api.get<RawQuestion>(`/api/admin/problems/${draft.ID}`))
        );

        const fetchedDrafts = detailResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => buildDraftFromServerQuestion((result as PromiseFulfilledResult<{ data: RawQuestion }>).value.data))
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));

        setDrafts(fetchedDrafts);
        saveDrafts(fetchedDrafts);
      } catch (err: unknown) {
        if (isAxiosError(err) && err.response?.status === 401) {
          setError("Your session is invalid or expired. Please sign in again to load your drafts.");
        } else if (isAxiosError(err) && err.response?.status === 403) {
          setError("You are not authorized to load professor drafts.");
        } else if (isAxiosError(err) && err.response?.status === 404) {
          setError("Failed to load draft questions.");
        } else if (isAxiosError(err) && !err.response) {
          setError("Could not reach draft endpoint due to a network/CORS issue. Please verify backend route and CORS configuration.");
        } else {
          const statusCode = isAxiosError(err) ? err.response?.status : undefined;
          const responseMessage = isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
            ? (err.response.data as { message?: unknown }).message
            : undefined;
          const normalizedResponseMessage = typeof responseMessage === "string" ? responseMessage : "";

          console.error("[ProfessorDraftsPage] Failed to load draft questions", {
            statusCode,
            responseData: isAxiosError(err) ? err.response?.data : undefined,
            requestUrl: isAxiosError(err) ? err.config?.url : undefined,
            requestMethod: isAxiosError(err) ? err.config?.method : undefined,
          });

          if (statusCode) {
            setError(
              normalizedResponseMessage
                ? `Failed to load draft questions. (HTTP ${statusCode}: ${normalizedResponseMessage})`
                : `Failed to load draft questions. (HTTP ${statusCode})`
            );
          } else {
            setError("Failed to load draft questions.");
          }
        }
      }
    };

    fetchDrafts();
  }, [activeTab, isProfessor]);

  useEffect(() => {
    const fetchPublishedQuestions = async () => {
      if (!isProfessor || activeTab !== "published") {
        return;
      }

      setIsLoadingPublished(true);
      setPublishedLoadError("");

      try {
        const userDataRaw = localStorage.getItem("user_data");
        const parsedUser = userDataRaw ? JSON.parse(userDataRaw) as { id?: number; ID?: number; firstName?: string; lastName?: string; name?: string } : {};
        const parsedUserIdValue = (parsedUser.id ?? parsedUser.ID) as unknown;
        const parsedUserId = Number(parsedUserIdValue);
        const userId = Number.isFinite(parsedUserId) ? parsedUserId : null;

        const allSubcategories = Array.from(
          new Set(availableSubcategories.length > 0 ? availableSubcategories : defaultSubcategories)
        );
        const results = await Promise.allSettled(
          allSubcategories.map((subcategory) =>
            api.get<RawQuestion[]>(`/api/test/topic/${encodeURIComponent(subcategory)}`)
          )
        );

        const mergedQuestions: RawQuestion[] = [];
        results.forEach((result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value.data)) {
            mergedQuestions.push(...result.value.data);
          }
        });

        const dedupedById = new Map<number, RawQuestion>();
        mergedQuestions.forEach((question) => {
          if (typeof question.ID === "number") {
            dedupedById.set(question.ID, question);
          }
        });

        const toPublishedQuestion = (question: RawQuestion): PublishedQuestion => ({
          id: question.ID,
          section: question.SECTION,
          category: question.CATEGORY,
          subcategory: question.SUBCATEGORY,
          questionType: question.TYPE,
          authorExamId: question.AUTHOR_EXAM_ID,
          ownerId: question.OWNER_ID,
        });

        const ownerMatches = (question: RawQuestion) => {
          if (userId === null) return true;
          const questionOwnerId = Number(question.OWNER_ID);
          return Number.isFinite(questionOwnerId) && questionOwnerId === userId;
        };

        // /api/test/topic/:topicName already returns published questions only.
        // Keep only ownership filtering on the client for professor-specific management UI.
        const filtered = Array.from(dedupedById.values())
          .filter(ownerMatches)
          .map(toPublishedQuestion)
          .sort((first, second) => second.id - first.id);

        setPublishedQuestions(filtered);
      } catch {
        setPublishedLoadError("Failed to load published questions.");
        setPublishedQuestions([]);
      } finally {
        setIsLoadingPublished(false);
      }
    };

    fetchPublishedQuestions();
  }, [activeTab, isProfessor, availableSubcategories]);

  useLayoutEffect(() => {
    if (form.questionType !== "Ranked Choice") {
      answerPositions.current = new Map();
      return;
    }

    const newPositions = new Map<string, DOMRect>();
    answerRefs.current.forEach((node, key) => {
      if (node) {
        newPositions.set(key, node.getBoundingClientRect());
      }
    });

    answerRefs.current.forEach((node, key) => {
      if (!node) return;

      const previousBox = answerPositions.current.get(key);
      const newBox = newPositions.get(key);
      if (!previousBox || !newBox) return;

      const deltaY = previousBox.top - newBox.top;
      if (deltaY !== 0) {
        node.style.transition = "transform 0s";
        node.style.transform = `translateY(${deltaY}px)`;
        node.getBoundingClientRect();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            node.style.transform = "";
            node.style.transition = "transform 180ms ease";
          });
        });
      }
    });

    answerPositions.current = newPositions;
  }, [form.answers, form.questionType]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    if (name === "questionType") {
      const firstCorrectIndex = form.answers.findIndex((answer) => answer.isCorrect);

      setForm((prev) => ({
        ...prev,
        [name]: value,
        answers:
          value === "Ranked Choice"
            ? syncAnswerRanks(prev.answers.map((answer) => ({ ...answer, isCorrect: true })))
            : value === "Fill in the Blanks"
              ? [
                  {
                    ...(prev.answers[0] ?? createEmptyAnswer(0)),
                    rank: 1,
                    placement: "",
                  },
                ]
            : value === "Multiple Choice"
              ? syncAnswerRanks(
                  prev.answers.map((answer, index) => ({
                    ...answer,
                    placement: "",
                    isCorrect: firstCorrectIndex >= 0 ? index === firstCorrectIndex : index === 0,
                  }))
                )
            : value === "Select All That Apply"
              ? syncAnswerRanks(prev.answers.map((answer) => ({ ...answer, placement: "" })))
            : value === "Drag and Drop"
              ? syncAnswerRanks(prev.answers.map((answer) => ({ ...answer, isCorrect: true })))
            : prev.answers,
      }));
      return;
    }

    if (name === "category") {
      setForm((prev) => {
        const nextCategory = value;
        const allowedSubcategories = topicCategoryMap[nextCategory] ?? [];
        const shouldClearSubcategory =
          allowedSubcategories.length > 0 && !allowedSubcategories.includes(prev.subcategory);

        return {
          ...prev,
          category: nextCategory,
          subcategory: shouldClearSubcategory ? "" : prev.subcategory,
        };
      });
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const escapeHtml = (value: string) => (
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  );

  const insertQuestionTextMarkup = (transform: (selectedText: string) => string) => {
    const textarea = questionTextRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const selectedText = form.questionText.slice(start, end);
    const replacement = transform(selectedText);
    const updatedText = `${form.questionText.slice(0, start)}${replacement}${form.questionText.slice(end)}`;

    setForm((prev) => ({ ...prev, questionText: updatedText }));

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPosition = start + replacement.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const wrapQuestionSelection = (tag: string) => {
    insertQuestionTextMarkup((selectedText) => `<${tag}>${selectedText}</${tag}>`);
  };

  const insertParagraph = () => {
    wrapQuestionSelection("p");
  };

  const insertLineBreak = () => {
    insertQuestionTextMarkup(() => "<br />");
  };

  const insertQuestionList = (ordered: boolean) => {
    const listTag = ordered ? "ol" : "ul";
    insertQuestionTextMarkup((selectedText) => {
      const items = selectedText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      const listItems = items.length > 0
        ? items.map((item) => `  <li>${item}</li>`).join("\n")
        : "  <li></li>";
      return `<${listTag}>\n${listItems}\n</${listTag}>`;
    });
  };

  const insertInlineCode = () => {
    insertQuestionTextMarkup((selectedText) => `<code>${escapeHtml(selectedText)}</code>`);
  };

  const insertCodeBlock = () => {
    insertQuestionTextMarkup(
      (selectedText) => `<pre><code>${escapeHtml(selectedText)}</code></pre>`
    );
  };

  const resolveAuthorExamId = useCallback((): string => {
    try {
      const rawUserData = localStorage.getItem("user_data");
      if (!rawUserData) {
        return "Professor";
      }

      const parsed = JSON.parse(rawUserData) as {
        firstName?: string;
        lastName?: string;
        name?: string;
      };

      const firstName = (parsed.firstName || "").trim();
      const lastName = (parsed.lastName || "").trim();
      const fullName = `${firstName} ${lastName}`.trim();

      return fullName || (parsed.name || "").trim() || "Professor";
    } catch {
      return "Professor";
    }
  }, []);

  const createQuestionFromDraft = async (
    draft: QuestionDraft,
    isPublished: boolean
  ): Promise<number | undefined> => {
    const authorExamId = resolveAuthorExamId();
    const filteredAnswers = draft.answers.filter((answer) => answer.text.trim());
    const response = await api.post("/api/admin/createquestion", {
      type: draft.questionType,
      author_exam_id: authorExamId,
      section: draft.section || "General",
      category: draft.category || "General",
      subcategory: draft.subcategory || "General",
      points_possible: 1,
      is_published: isPublished ? 1 : 0,
      question_text: draft.questionText,
      answer_text: filteredAnswers.map((answer) => answer.text.trim()),
      answer_correctness: filteredAnswers.map((answer) => ((draft.questionType === "Ranked Choice" || draft.questionType === "Drag and Drop") ? 1 : (answer.isCorrect ? 1 : 0))),
      answer_rank: filteredAnswers.map((answer, index) => {
        if (draft.questionType === "Ranked Choice" || draft.questionType === "Multiple Choice" || draft.questionType === "Fill in the Blanks" || draft.questionType === "Select All That Apply") {
          return index + 1;
        }

        const parsedRank = Number(answer.rank);
        return Number.isFinite(parsedRank) ? parsedRank : index + 1;
      }),
      answer_placement: filteredAnswers.map((answer) => answer.placement || ""),
    });

    return response?.data?.questionId;
  };

  const unpublishQuestionFromPublished = useCallback(async (question: RawQuestion): Promise<void> => {
    const normalizedQuestionType = normalizeQuestionType(question.TYPE);
    const sourceAnswers = Array.isArray(question.answers) ? question.answers : [];

    if (sourceAnswers.length === 0) {
      throw new Error("Published question has no answers and cannot be converted to a draft.");
    }

    await api.put(`/api/admin/problems/${question.ID}`, {
      type: normalizedQuestionType,
      author_exam_id: String(question.AUTHOR_EXAM_ID || resolveAuthorExamId()),
      section: String(question.SECTION || "General"),
      category: String(question.CATEGORY || "General"),
      subcategory: String(question.SUBCATEGORY || "General"),
      points_possible: Number(question.POINTS_POSSIBLE) || 1,
      question_text: String(question.QUESTION_TEXT || ""),
      answer_text: sourceAnswers.map((answer) => String(answer.TEXT || "").trim()),
      answer_correctness: sourceAnswers.map((answer) => (
        normalizedQuestionType === "Ranked Choice" || normalizedQuestionType === "Drag and Drop"
          ? 1
          : (parseAnswerCorrectness(answer.IS_CORRECT_ANSWER) ? 1 : 0)
      )),
      answer_rank: sourceAnswers.map((answer, index) => {
        const parsedRank = Number(answer.RANK);
        return Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : index + 1;
      }),
      answer_placement: sourceAnswers.map((answer) => String(answer.PLACEMENT || "")),
    });
  }, [resolveAuthorExamId]);

  const handleSaveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.title.trim() || !form.questionText.trim()) {
      setError("Title and question text are required.");
      return;
    }

    const nonEmptyAnswers = form.answers.filter((answer) => answer.text.trim().length > 0);
    if (nonEmptyAnswers.length === 0) {
      setError("At least one answer text is required.");
      return;
    }

    if (form.questionType !== "Ranked Choice" && form.questionType !== "Drag and Drop" && !nonEmptyAnswers.some((answer) => answer.isCorrect)) {
      setError("At least one answer must be marked correct.");
      return;
    }

    if (form.questionType === "Multiple Choice") {
      const correctCount = nonEmptyAnswers.filter((answer) => answer.isCorrect).length;
      if (correctCount !== 1) {
        setError("Multiple choice questions must have exactly one correct answer.");
        return;
      }
    }

    if (form.questionType === "Drag and Drop") {
      const nonEmptyDropSections = form.dropSections.map((item) => item.trim()).filter(Boolean);
      if (nonEmptyDropSections.length === 0) {
        setError("Add at least one drop section for drag and drop questions.");
        return;
      }

      const hasInvalidPlacement = nonEmptyAnswers.some((answer) => !nonEmptyDropSections.includes(answer.placement.trim()));
      if (hasInvalidPlacement) {
        setError("Each answer must be assigned to one of the defined drop sections.");
        return;
      }
    }

    const now = new Date().toISOString();

    if (editingId) {
      const existingDraft = drafts.find((draft) => draft.id === editingId);
      const draftQuestionId = Number(editingId);

      const nextDraftState: QuestionDraft = {
        id: editingId,
        title: form.title.trim(),
        section: form.section.trim(),
        category: form.category.trim(),
        subcategory: form.subcategory.trim(),
        questionType: form.questionType,
        questionText: form.questionText.trim(),
        answers: form.answers.map((answer, index) => ({
          ...answer,
          text: answer.text.trim(),
          isCorrect: form.questionType === "Ranked Choice" || form.questionType === "Drag and Drop" ? true : answer.isCorrect,
          rank: form.questionType === "Ranked Choice" || form.questionType === "Multiple Choice" || form.questionType === "Fill in the Blanks" || form.questionType === "Select All That Apply"
            ? index + 1
            : (Number.isFinite(answer.rank) ? answer.rank : index + 1),
          placement: form.questionType === "Drag and Drop" ? answer.placement.trim() : "",
        })),
        dropSections: form.dropSections.map((item) => item.trim()).filter(Boolean),
        updatedAt: now,
        publishedQuestionId: existingDraft?.publishedQuestionId,
      };

      if (!Number.isFinite(draftQuestionId) || draftQuestionId <= 0) {
        setError("This draft is not linked to a server question. Delete and recreate it to continue.");
        return;
      }

      setPublishingDraftId(editingId);

      try {
        const filteredAnswers = nextDraftState.answers.filter((answer) => answer.text.trim());

        await api.put(`/api/admin/problems/${draftQuestionId}`, {
          type: nextDraftState.questionType,
          author_exam_id: resolveAuthorExamId(),
          section: nextDraftState.section || "General",
          category: nextDraftState.category || "General",
          subcategory: nextDraftState.subcategory || "General",
          points_possible: 1,
          question_text: nextDraftState.questionText,
          answer_text: filteredAnswers.map((answer) => answer.text.trim()),
          answer_correctness: filteredAnswers.map((answer) => ((nextDraftState.questionType === "Ranked Choice" || nextDraftState.questionType === "Drag and Drop") ? 1 : (answer.isCorrect ? 1 : 0))),
          answer_rank: filteredAnswers.map((answer, index) => {
            if (nextDraftState.questionType === "Ranked Choice" || nextDraftState.questionType === "Multiple Choice" || nextDraftState.questionType === "Fill in the Blanks" || nextDraftState.questionType === "Select All That Apply") {
              return index + 1;
            }

            const parsedRank = Number(answer.rank);
            return Number.isFinite(parsedRank) ? parsedRank : index + 1;
          }),
          answer_placement: filteredAnswers.map((answer) => answer.placement || ""),
        });

        nextDraftState.publishedQuestionId = undefined;
      } catch (err: unknown) {
        const message =
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
            ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
            : "Failed to update draft on the server.";

        setError(message);
        setPublishingDraftId(null);
        return;
      } finally {
        setPublishingDraftId(null);
      }

      const updated = drafts.map((draft) => (
        draft.id === editingId
          ? nextDraftState
          : draft
      ));

      setDrafts(updated);
      saveDrafts(updated);
      setSuccessMessage("Draft updated.");
      resetForm();
      return;
    }

    const newDraft: QuestionDraft = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      section: form.section.trim(),
      category: form.category.trim(),
      subcategory: form.subcategory.trim(),
      questionType: form.questionType,
      questionText: form.questionText.trim(),
      answers: form.answers.map((answer, index) => ({
        ...answer,
        text: answer.text.trim(),
        isCorrect: form.questionType === "Ranked Choice" || form.questionType === "Drag and Drop" ? true : answer.isCorrect,
        rank: form.questionType === "Ranked Choice" || form.questionType === "Multiple Choice" || form.questionType === "Fill in the Blanks" || form.questionType === "Select All That Apply"
          ? index + 1
          : (Number.isFinite(answer.rank) ? answer.rank : index + 1),
        placement: form.questionType === "Drag and Drop" ? answer.placement.trim() : "",
      })),
      dropSections: form.dropSections.map((item) => item.trim()).filter(Boolean),
      updatedAt: now,
    };

    setPublishingDraftId("new");

    try {
      const createdQuestionId = await createQuestionFromDraft(newDraft, false);
      if (!createdQuestionId) {
        setError("Draft was created but no ID was returned by the server.");
        setPublishingDraftId(null);
        return;
      }

      const persistedDraft = {
        ...newDraft,
        id: String(createdQuestionId),
      };

      const updated = [persistedDraft, ...drafts];
      setDrafts(updated);
      saveDrafts(updated);
      setSuccessMessage("Draft created.");
      resetForm();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to create draft on the server.";

      setError(message);
    } finally {
      setPublishingDraftId(null);
    }
  };

  const handleEditDraft = useCallback((draft: QuestionDraft) => {
    setError("");
    setSuccessMessage("");
    setActiveTab("drafts");
    setEditingId(draft.id);
    setForm({
      title: draft.title,
      section: draft.section,
      category: draft.category,
      subcategory: draft.subcategory,
      questionType: draft.questionType,
      questionText: draft.questionText,
      answers: draft.answers.length > 0 ? draft.answers : createDefaultAnswers(),
      dropSections: draft.dropSections.length > 0 ? draft.dropSections : createDefaultDropSections(),
    });
  }, []);

  const handleAnswerChange = (
    answerId: string,
    field: keyof DraftAnswer,
    value: string | number | boolean
  ) => {
    if (field === "isCorrect") {
      setForm((prev) => {
        if (prev.questionType === "Multiple Choice") {
          return {
            ...prev,
            answers: prev.answers.map((answer) => ({
              ...answer,
              isCorrect: answer.id === answerId ? Boolean(value) : false,
            })),
          };
        }

        return {
          ...prev,
          answers: prev.answers.map((answer) => (
            answer.id === answerId
              ? {
                  ...answer,
                  isCorrect: Boolean(value),
                }
              : answer
          )),
        };
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      answers: prev.answers.map((answer) => (
        answer.id === answerId
          ? {
              ...answer,
              [field]: value,
            }
          : answer
      )),
    }));
  };

  const handleAddAnswer = () => {
    setForm((prev) => ({
      ...prev,
      answers: syncAnswerRanks([
        ...prev.answers,
        {
          ...createEmptyAnswer(prev.answers.length),
          isCorrect: prev.questionType === "Ranked Choice" || prev.questionType === "Drag and Drop",
        },
      ]),
    }));
  };

  const handleDeleteAnswer = (answerId: string) => {
    setForm((prev) => {
      const filteredAnswers = prev.answers.filter((answer) => answer.id !== answerId);
      return {
        ...prev,
        answers: syncAnswerRanks(filteredAnswers.length > 0 ? filteredAnswers : createDefaultAnswers()),
      };
    });
    setPendingDeleteAnswerId(null);
  };

  const handleRequestDeleteAnswer = (answerId: string) => {
    setPendingDeleteAnswerId(answerId);
  };

  const handleCancelDeleteAnswer = () => {
    setPendingDeleteAnswerId(null);
  };

  const handleAnswerDragStart = (answerId: string) => {
    if (form.questionType !== "Ranked Choice") return;
    setDraggedAnswerId(answerId);
  };

  const handleAnswerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (form.questionType !== "Ranked Choice") return;
    event.preventDefault();
  };

  const handleAnswerDrop = (targetAnswerId: string) => {
    if (form.questionType !== "Ranked Choice" || !draggedAnswerId || draggedAnswerId === targetAnswerId) {
      setDraggedAnswerId(null);
      return;
    }

    setForm((prev) => {
      const draggedIndex = prev.answers.findIndex((answer) => answer.id === draggedAnswerId);
      const targetIndex = prev.answers.findIndex((answer) => answer.id === targetAnswerId);

      if (draggedIndex < 0 || targetIndex < 0) {
        return prev;
      }

      const reordered = [...prev.answers];
      const [dragged] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, dragged);

      return {
        ...prev,
        answers: syncAnswerRanks(reordered),
      };
    });

    setDraggedAnswerId(null);
  };

  const handleAnswerDragEnd = () => {
    setDraggedAnswerId(null);
  };

  const handleDropSectionChange = (index: number, value: string) => {
    setForm((prev) => {
      const updatedDropSections = [...prev.dropSections];
      updatedDropSections[index] = value;
      return {
        ...prev,
        dropSections: updatedDropSections,
      };
    });
  };

  const handleAddDropSection = () => {
    setForm((prev) => ({
      ...prev,
      dropSections: [...prev.dropSections, `Section ${prev.dropSections.length + 1}`],
    }));
  };

  const handleDeleteDropSection = (index: number) => {
    setForm((prev) => {
      const removedSection = prev.dropSections[index];
      const updatedDropSections = prev.dropSections.filter((_, i) => i !== index);

      return {
        ...prev,
        dropSections: updatedDropSections.length > 0 ? updatedDropSections : createDefaultDropSections(),
        answers: prev.answers.map((answer) => (
          answer.placement === removedSection
            ? { ...answer, placement: "" }
            : answer
        )),
      };
    });
  };

  const handleDeleteDraft = async (draftId: string) => {
    setError("");
    setSuccessMessage("");

    const numericDraftId = Number(draftId);
    if (Number.isFinite(numericDraftId) && numericDraftId > 0) {
      try {
        await api.delete(`/api/admin/problems/${numericDraftId}`);
      } catch (err: unknown) {
        const message = buildDeleteErrorMessage(err, "Failed to delete draft on the server.", "draft");

        setError(message);
        return;
      }
    }

    const updated = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(updated);
    saveDrafts(updated);

    if (editingId === draftId) {
      resetForm();
    }

    setSuccessMessage("Draft deleted.");
  };

  const handlePublishDraft = async (draft: QuestionDraft) => {
    setError("");
    setSuccessMessage("");

    if (typeof draft.publishedQuestionId === "number") {
      setSuccessMessage(`Draft is already published as question #${draft.publishedQuestionId}.`);
      return;
    }

    setPublishingDraftId(draft.id);

    try {
      const draftQuestionId = Number(draft.id);
      let publishedQuestionId: number | undefined;

      if (Number.isFinite(draftQuestionId) && draftQuestionId > 0) {
        await api.post(`/api/admin/problems/${draftQuestionId}/publish`);
        publishedQuestionId = draftQuestionId;
      } else {
        publishedQuestionId = await createQuestionFromDraft(draft, true);
      }

      const updated = drafts.map((item) => (
        item.id === draft.id
          ? { ...item, publishedQuestionId: typeof publishedQuestionId === "number" ? publishedQuestionId : undefined }
          : item
      ));

      setDrafts(updated);
      saveDrafts(updated);
      setSuccessMessage(
        typeof publishedQuestionId === "number"
          ? `Draft published as question #${publishedQuestionId}.`
          : "Draft published successfully."
      );
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to publish draft. Please try again.";

      setError(message);
    } finally {
      setPublishingDraftId(null);
    }
  };

  const handleEditPublishedQuestion = useCallback(async (questionId: number) => {
    setError("");
    setSuccessMessage("");
    setPublishedActionId(questionId);

    try {
      const response = await api.get<RawQuestion>(`/api/admin/problems/${questionId}`);
      const question = response.data;
      await unpublishQuestionFromPublished(question);

      const linkedDraft = linkedDraftByPublishedId.get(questionId);
      const nextDraft = {
        ...buildDraftFromPublishedQuestion(question, linkedDraft),
        publishedQuestionId: undefined,
      };

      const updatedDrafts = linkedDraft
        ? drafts.map((draft) => (draft.id === linkedDraft.id ? nextDraft : draft))
        : [nextDraft, ...drafts];

      setDrafts(updatedDrafts);
      saveDrafts(updatedDrafts);
      setPublishedQuestions((prev) => prev.filter((item) => item.id !== questionId));
      handleEditDraft(nextDraft);
      setSuccessMessage(
        linkedDraft
          ? `Published question #${questionId} was unpublished and loaded into the linked draft.`
          : `Published question #${questionId} was unpublished and converted to a draft.`
      );
    } catch (err: unknown) {
      const explicitError = err instanceof Error ? err.message : "";
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : (explicitError || "Failed to convert published question to draft.");

      setError(message);
    } finally {
      setPublishedActionId(null);
    }
  }, [drafts, linkedDraftByPublishedId, handleEditDraft, unpublishQuestionFromPublished]);

  const handleDeletePublishedQuestion = async (questionId: number) => {
    setError("");
    setSuccessMessage("");
    setPublishedActionId(questionId);

    try {
      await api.delete(`/api/admin/problems/${questionId}`);

      setPublishedQuestions((prev) => prev.filter((question) => question.id !== questionId));
      const updatedDrafts = drafts.map((draft) => (
        draft.publishedQuestionId === questionId
          ? { ...draft, publishedQuestionId: undefined, updatedAt: new Date().toISOString() }
          : draft
      ));
      setDrafts(updatedDrafts);
      saveDrafts(updatedDrafts);
      setSuccessMessage(`Deleted published question #${questionId}.`);
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError("Your session is invalid or expired. Please sign in again and retry deleting this question.");
      } else if (isAxiosError(err) && err.response?.status === 403) {
        setError("You can only delete published questions that belong to your professor account.");
      } else {
        const message = buildDeleteErrorMessage(err, "Failed to delete published question.", "published");

        setError(message);
      }
    } finally {
      setPendingDeletePublishedId(null);
      setPublishedActionId(null);
    }
  };

  useEffect(() => {
    if (!isProfessor) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const draftIdParam = params.get("draftId");
    const publishedIdParam = params.get("publishedId");

    if (!draftIdParam && !publishedIdParam) {
      handledDashboardActionRef.current = null;
      return;
    }

    const actionKey = `${draftIdParam || ""}|${publishedIdParam || ""}`;
    if (handledDashboardActionRef.current === actionKey) {
      return;
    }

    handledDashboardActionRef.current = actionKey;

    const runDashboardAction = async () => {
      if (publishedIdParam) {
        const publishedQuestionId = Number(publishedIdParam);
        if (Number.isFinite(publishedQuestionId) && publishedQuestionId > 0) {
          await handleEditPublishedQuestion(publishedQuestionId);
        } else {
          setError("Invalid published question ID provided.");
        }

        navigate("/professor-drafts", { replace: true });
        return;
      }

      const draftQuestionId = Number(draftIdParam);
      if (!Number.isFinite(draftQuestionId) || draftQuestionId <= 0) {
        setError("Invalid draft question ID provided.");
        navigate("/professor-drafts", { replace: true });
        return;
      }

      const existingDraft = drafts.find((draft) => Number(draft.id) === draftQuestionId);
      if (existingDraft) {
        handleEditDraft(existingDraft);
        navigate("/professor-drafts", { replace: true });
        return;
      }

      try {
        const response = await api.get<RawQuestion>(`/api/admin/problems/${draftQuestionId}`);
        const fetchedDraft = buildDraftFromServerQuestion(response.data);

        setDrafts((prev) => {
          const next = [fetchedDraft, ...prev.filter((draft) => draft.id !== fetchedDraft.id)];
          saveDrafts(next);
          return next;
        });

        handleEditDraft(fetchedDraft);
      } catch {
        setError("Failed to load the selected draft.");
      } finally {
        navigate("/professor-drafts", { replace: true });
      }
    };

    runDashboardAction();
  }, [isProfessor, location.search, navigate, drafts, handleEditDraft, handleEditPublishedQuestion]);

  if (!isProfessor) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6 text-center">
            This page is only available to professor accounts.
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-100 min-h-full py-8 px-4">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Question Drafts</h1>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("drafts")}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                activeTab === "drafts"
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Drafts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("published")}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                activeTab === "published"
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Published Questions
            </button>
          </div>

          {error && <p className="text-red-500 mb-4">{error}</p>}
          {successMessage && <p className="text-green-600 mb-4">{successMessage}</p>}

          {activeTab === "drafts" && (
          <>
          <form onSubmit={handleSaveDraft} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Draft title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Draft title"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                name="section"
                value={form.section}
                onChange={handleChange}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              >
                <option value="">Select section</option>
                {availableSections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              >
                <option value="">Select category</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                name="subcategory"
                value={form.subcategory}
                onChange={handleChange}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              >
                <option value="">Select subcategory</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Question Text</label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  title="Bold"
                  aria-label="Bold"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => wrapQuestionSelection("strong")}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  title="Italic"
                  aria-label="Italic"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => wrapQuestionSelection("em")}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <Italic size={16} />
                </button>
                <button
                  type="button"
                  title="Underline"
                  aria-label="Underline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => wrapQuestionSelection("u")}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <Underline size={16} />
                </button>
                <button
                  type="button"
                  title="Paragraph"
                  aria-label="Paragraph"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={insertParagraph}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <Pilcrow size={16} />
                </button>
                <button
                  type="button"
                  title="Line Break"
                  aria-label="Line Break"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={insertLineBreak}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  title="Bullet List"
                  aria-label="Bullet List"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertQuestionList(false)}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  title="Numbered List"
                  aria-label="Numbered List"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertQuestionList(true)}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <ListOrdered size={16} />
                </button>
                <button
                  type="button"
                  title="Inline Code"
                  aria-label="Inline Code"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={insertInlineCode}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <Code size={16} />
                </button>
                <button
                  type="button"
                  title="Code Block"
                  aria-label="Code Block"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={insertCodeBlock}
                  className="h-9 w-9 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-800 transition flex items-center justify-center"
                >
                  <FileCode size={16} />
                </button>
              </div>
              <textarea
                ref={questionTextRef}
                name="questionText"
                value={form.questionText}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Write the question draft..."
                required
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">Question text supports HTML formatting.</p>
                <button
                  type="button"
                  onClick={() => setShowQuestionPreview((prev) => !prev)}
                  className="text-sm text-blue-600 hover:underline font-semibold"
                >
                  {showQuestionPreview ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
              {showQuestionPreview && (
                <div className="mt-3 border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Test Page Preview</h3>
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 bg-white rounded-lg border border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between mb-2 text-sm sm:text-lg md:text-xl">
                      <p className="text-gray-600">Section {form.section || "—"}</p>
                      <p className="font-medium">Question 1 of 1</p>
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                      {form.category || "Category"} <span className="text-yellow-600">&gt;</span>{" "}
                      {form.subcategory || "Subcategory"}
                      <span className="block text-sm sm:text-base md:text-lg text-gray-500 font-normal mt-1 sm:mt-0">
                        (Credit: {form.title || "Draft"})
                      </span>
                    </h1>

                    <h2 className="text-lg font-semibold mb-2">Question 1 of 1</h2>

                    <div className="text-base sm:text-lg md:text-xl font-medium mb-4 text-gray-800 leading-relaxed [&_pre]:bg-gray-100 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm">
                      {form.questionText.trim().length > 0
                        ? parse(questionPreviewHtml)
                        : <span className="text-gray-500">Nothing to preview yet.</span>}
                    </div>

                    {(form.questionType === "Multiple Choice" || form.questionType === "Select All That Apply") && (
                      <div className="space-y-3 mb-2">
                        {form.answers.filter((answer) => answer.text.trim()).map((answer) => (
                          <label
                            key={answer.id}
                            className="block p-3 sm:p-4 rounded-lg border bg-white border-gray-300 text-sm sm:text-base md:text-lg"
                          >
                            <input
                              type={form.questionType === "Select All That Apply" ? "checkbox" : "radio"}
                              disabled
                              className="mr-3"
                            />
                            {answer.text}
                          </label>
                        ))}
                      </div>
                    )}

                    {form.questionType === "Fill in the Blanks" && (
                      <div className="mb-2">
                        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Your Answer:</label>
                        <input
                          type="text"
                          disabled
                          placeholder="Type your answer here..."
                          className="w-full p-3 sm:p-4 rounded-lg border text-sm sm:text-base md:text-lg bg-white border-gray-300"
                        />
                      </div>
                    )}

                    {form.questionType === "Ranked Choice" && (
                      <div className="space-y-2 mb-2">
                        {form.answers.filter((answer) => answer.text.trim()).map((answer, index) => (
                          <div key={answer.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 bg-white">
                            <span className="text-sm font-semibold text-gray-600 w-6">{index + 1}.</span>
                            <span className="text-sm sm:text-base md:text-lg text-gray-800">{answer.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {form.questionType === "Drag and Drop" && (
                      <div className="space-y-2 mb-2">
                        {form.answers.filter((answer) => answer.text.trim()).map((answer) => (
                          <div key={answer.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-300 bg-white">
                            <span className="text-sm sm:text-base md:text-lg text-gray-800">{answer.text}</span>
                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {answer.placement || "Unassigned"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Question Type</label>
              <select
                name="questionType"
                value={form.questionType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              >
                {questionTypeOptions.map((questionType) => (
                  <option key={questionType} value={questionType}>
                    {questionType}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-gray-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Answer Texts</h2>
                <button
                  type="button"
                  onClick={handleAddAnswer}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition"
                >
                  Add Answer
                </button>
              </div>
              {form.questionType === "Ranked Choice" && (
                <p className="text-sm text-gray-600 mb-3">
                  Drag answers to reorder their rank.
                </p>
              )}

              <div className="space-y-3">
                {form.answers.map((answer, index) => (
                  form.questionType === "Ranked Choice" ? (
                    <div
                      key={answer.id}
                      ref={(node) => {
                        if (node) {
                          answerRefs.current.set(answer.id, node);
                        } else {
                          answerRefs.current.delete(answer.id);
                        }
                      }}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-1 items-center rounded-lg p-2 transition-colors duration-150 ${
                        draggedAnswerId === answer.id
                          ? "bg-yellow-50 border border-yellow-300"
                          : ""
                      }`}
                      draggable
                      onDragStart={() => handleAnswerDragStart(answer.id)}
                      onDragOver={handleAnswerDragOver}
                      onDrop={() => handleAnswerDrop(answer.id)}
                      onDragEnd={handleAnswerDragEnd}
                    >
                      <div className="md:col-span-10 flex items-center gap-1">
                        <div className="w-6 h-10 flex items-center justify-center text-gray-400 select-none">
                          <GripVertical size={16} />
                        </div>
                        <input
                          value={answer.text}
                          onChange={(event) => handleAnswerChange(answer.id, "text", event.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder={`Answer ${index + 1}`}
                        />
                      </div>
                      <div className="md:col-span-2 justify-self-end flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => (pendingDeleteAnswerId === answer.id ? handleDeleteAnswer(answer.id) : handleRequestDeleteAnswer(answer.id))}
                          className="h-10 w-10 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center"
                          aria-label={pendingDeleteAnswerId === answer.id ? "Confirm delete answer" : "Request delete answer"}
                        >
                          {pendingDeleteAnswerId === answer.id ? <Trash2 size={18} /> : "X"}
                        </button>
                        {pendingDeleteAnswerId === answer.id && (
                          <button
                            type="button"
                            onClick={handleCancelDeleteAnswer}
                            className="h-10 w-10 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition flex items-center justify-center"
                            aria-label="Cancel delete answer"
                          >
                            X
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={answer.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg p-2"
                    >
                      {form.questionType === "Multiple Choice" || form.questionType === "Fill in the Blanks" || form.questionType === "Select All That Apply" ? (
                        <>
                          <input
                            value={answer.text}
                            onChange={(event) => handleAnswerChange(answer.id, "text", event.target.value)}
                            className="md:col-span-8 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder={`Answer ${index + 1}`}
                          />

                          <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={answer.isCorrect}
                              onChange={(event) => handleAnswerChange(answer.id, "isCorrect", event.target.checked)}
                            />
                            Correct
                          </label>

                          <div className="md:col-span-2 justify-self-end flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => (pendingDeleteAnswerId === answer.id ? handleDeleteAnswer(answer.id) : handleRequestDeleteAnswer(answer.id))}
                              className="h-10 w-10 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center"
                              aria-label={pendingDeleteAnswerId === answer.id ? "Confirm delete answer" : "Request delete answer"}
                            >
                              {pendingDeleteAnswerId === answer.id ? <Trash2 size={18} /> : "X"}
                            </button>
                            {pendingDeleteAnswerId === answer.id && (
                              <button
                                type="button"
                                onClick={handleCancelDeleteAnswer}
                                className="h-10 w-10 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition flex items-center justify-center"
                                aria-label="Cancel delete answer"
                              >
                                X
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            value={answer.text}
                            onChange={(event) => handleAnswerChange(answer.id, "text", event.target.value)}
                            className={`${form.questionType === "Drag and Drop" ? "md:col-span-7" : "md:col-span-5"} px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500`}
                            placeholder={`Answer ${index + 1}`}
                          />

                          {form.questionType !== "Drag and Drop" && (
                            <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={answer.isCorrect}
                                onChange={(event) => handleAnswerChange(answer.id, "isCorrect", event.target.checked)}
                              />
                              Correct
                            </label>
                          )}

                          {form.questionType !== "Drag and Drop" ? (
                            <input
                              type="number"
                              min={1}
                              value={answer.rank}
                              onChange={(event) => handleAnswerChange(answer.id, "rank", Number(event.target.value))}
                              className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              placeholder="Rank"
                            />
                          ) : null}

                          {form.questionType === "Drag and Drop" ? (
                            <div className="md:col-span-5 flex items-center justify-end gap-2">
                              <select
                                value={answer.placement}
                                onChange={(event) => handleAnswerChange(answer.id, "placement", event.target.value)}
                                className="w-full md:w-48 h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                required
                              >
                                <option value="">Drop Section</option>
                                {form.dropSections.map((dropSection, dropSectionIndex) => (
                                  <option key={`${dropSection}-${dropSectionIndex}`} value={dropSection.trim()}>
                                    {dropSection.trim() || `Section ${dropSectionIndex + 1}`}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => (pendingDeleteAnswerId === answer.id ? handleDeleteAnswer(answer.id) : handleRequestDeleteAnswer(answer.id))}
                                className="h-10 w-10 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center"
                                aria-label={pendingDeleteAnswerId === answer.id ? "Confirm delete answer" : "Request delete answer"}
                              >
                                {pendingDeleteAnswerId === answer.id ? <Trash2 size={18} /> : "X"}
                              </button>
                              {pendingDeleteAnswerId === answer.id && (
                                <button
                                  type="button"
                                  onClick={handleCancelDeleteAnswer}
                                  className="h-10 w-10 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition flex items-center justify-center"
                                  aria-label="Cancel delete answer"
                                >
                                  X
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <input
                                value={answer.placement}
                                onChange={(event) => handleAnswerChange(answer.id, "placement", event.target.value)}
                                className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                placeholder="Placement"
                              />
                              <button
                                type="button"
                                onClick={() => (pendingDeleteAnswerId === answer.id ? handleDeleteAnswer(answer.id) : handleRequestDeleteAnswer(answer.id))}
                                className="md:col-span-1 justify-self-end h-10 w-10 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition flex items-center justify-center"
                                aria-label={pendingDeleteAnswerId === answer.id ? "Confirm delete answer" : "Request delete answer"}
                              >
                                {pendingDeleteAnswerId === answer.id ? <Trash2 size={18} /> : "X"}
                              </button>
                              {pendingDeleteAnswerId === answer.id && (
                                <button
                                  type="button"
                                  onClick={handleCancelDeleteAnswer}
                                  className="md:col-span-1 justify-self-end h-10 w-10 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition flex items-center justify-center"
                                  aria-label="Cancel delete answer"
                                >
                                  X
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>

            {form.questionType === "Drag and Drop" && (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-800">Drop Sections</h2>
                  <button
                    type="button"
                    onClick={handleAddDropSection}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition"
                  >
                    Add Section
                  </button>
                </div>

                <div className="space-y-2">
                  {form.dropSections.map((dropSection, index) => (
                    <div key={`${dropSection}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <input
                        value={dropSection}
                        onChange={(event) => handleDropSectionChange(index, event.target.value)}
                        className="md:col-span-10 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        placeholder={`Section ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteDropSection(index)}
                        className="md:col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-2 rounded-lg transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition"
              >
                {editingId
                  ? typeof editingDraft?.publishedQuestionId === "number"
                    ? "Update Draft & Published"
                    : "Update Draft"
                  : "Create Draft"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={
                    typeof editingDraft?.publishedQuestionId === "number" &&
                    publishingDraftId === editingId
                  }
                  className="bg-gray-200 hover:bg-gray-300 disabled:hover:bg-gray-200 disabled:opacity-60 text-gray-800 font-semibold px-6 py-2 rounded-lg transition"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            {editingId &&
              typeof editingDraft?.publishedQuestionId === "number" &&
              publishingDraftId === editingId && (
                <p className="text-sm text-blue-600 font-medium mt-1">
                  Syncing published question...
                </p>
            )}
          </form>

          <div className="space-y-4">
            {sortedDrafts.length === 0 && (
              <p className="text-gray-600">No drafts yet. Create your first draft above.</p>
            )}

            {sortedDrafts.map((draft) => (
              <div key={draft.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-800">{draft.title}</h2>
                      {typeof draft.publishedQuestionId === "number" && (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-semibold">
                          Published
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {draft.section || "No section"} • {draft.category || "No category"} • {draft.subcategory || "No subcategory"}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Type: {draft.questionType}</p>
                    <p className="text-sm text-gray-600 mt-1">Answers: {draft.answers.length}</p>
                    {draft.questionType === "Drag and Drop" && (
                      <p className="text-sm text-gray-600 mt-1">
                        Drop Sections: {draft.dropSections.length}
                      </p>
                    )}
                    {typeof draft.publishedQuestionId === "number" && (
                      <p className="text-xs text-green-700 mt-1">
                        Published as Question ID: {draft.publishedQuestionId}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {new Date(draft.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditDraft(draft)}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublishDraft(draft)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                      disabled={publishingDraftId === draft.id || typeof draft.publishedQuestionId === "number"}
                    >
                      {publishingDraftId === draft.id
                        ? "Publishing..."
                        : typeof draft.publishedQuestionId === "number"
                          ? "Published"
                          : "Publish"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
          )}

          {activeTab === "published" && (
            <div className="space-y-4">
              {isLoadingPublished && (
                <p className="text-gray-600">Loading published questions...</p>
              )}

              {!isLoadingPublished && publishedLoadError && (
                <p className="text-red-500">{publishedLoadError}</p>
              )}

              {!isLoadingPublished && !publishedLoadError && publishedQuestions.length === 0 && (
                <p className="text-gray-600">No published questions found for this professor account.</p>
              )}

              {publishedQuestions.map((question) => {
                const linkedDraft = linkedDraftByPublishedId.get(question.id);

                return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-gray-800">Question #{question.id}</h2>
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-semibold">
                          Published
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {question.section || "No section"} • {question.category || "No category"} • {question.subcategory || "No subcategory"}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Type: {question.questionType}</p>
                      <p className="text-xs text-gray-600 mt-1">Credit: {question.authorExamId || "N/A"}</p>
                      <p className="text-xs text-green-700 mt-1">
                        Published Question ID: {question.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleEditPublishedQuestion(question.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                        disabled={publishedActionId === question.id}
                      >
                        {publishedActionId === question.id ? "Loading..." : linkedDraft ? "Open in Drafts" : "Create Draft"}
                      </button>
                      <button
                        type="button"
                        onClick={() => (
                          pendingDeletePublishedId === question.id
                            ? handleDeletePublishedQuestion(question.id)
                            : setPendingDeletePublishedId(question.id)
                        )}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
                        disabled={publishedActionId === question.id}
                      >
                        {pendingDeletePublishedId === question.id ? "Confirm Delete" : "Delete Published"}
                      </button>
                      {pendingDeletePublishedId === question.id && (
                        <button
                          type="button"
                          onClick={() => setPendingDeletePublishedId(null)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      )}
                      </div>

                      {linkedDraft ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleEditDraft(linkedDraft)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition"
                          >
                            Edit Local Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(linkedDraft.id)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition"
                          >
                            Delete Draft
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-600 max-w-xs">
                          No local draft is linked to this published question yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ProfessorDraftsPage;
