import React, { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Eye, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { RawQuestion } from "../models";

type FilterMode = "recent" | "oldest" | "drafts" | "published";
type QuestionStatus = "Draft" | "Published";

interface DraftListResponse {
  drafts?: RawQuestion[];
}

interface ProfessorQuestionItem {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  status: QuestionStatus;
}

const topicCategoryMap: Record<string, string[]> = {
  "Introductory Programming": ["Input/Output", "Branching", "Loops", "Variables"],
  "Simple Data Structures": ["Arrays", "Linked Lists", "Strings"],
  "Object Oriented Programming": ["Classes", "Methods"],
  "Intermediate Data Structures": ["Trees", "Stacks"],
  "Complex Data Structures": ["Heaps", "Tries"],
  "Intermediate Programming": ["Bitwise Operators", "Dynamic Memory", "Algorithm Analysis", "Recursion", "Sorting"],
};

const defaultSubcategories = Object.values(topicCategoryMap).flat();

const normalizeQuestionType = (questionType?: string): string => {
  const normalized = (questionType || "").trim();
  switch (normalized.toLowerCase()) {
    case "multiple choice":
    case "multiple_choice":
      return "Multiple Choice";
    case "fill in the blanks":
    case "fill_in_blank":
      return "Fill in the Blanks";
    case "select all that apply":
    case "select_all_that_apply":
      return "Select All That Apply";
    case "ranked choice":
    case "ranked_choice":
      return "Ranked Choice";
    case "drag and drop":
    case "drag_and_drop":
      return "Drag and Drop";
    default:
      return "Multiple Choice";
  }
};

const parseAnswerCorrectness = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return false;
};

const ProfessorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<ProfessorQuestionItem[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewQuestion, setPreviewQuestion] = useState<RawQuestion | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState("");

  const isProfessor = localStorage.getItem("account_type") === "professor";

  useEffect(() => {
    const fetchProfessorQuestions = async () => {
      if (!isProfessor) {
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      let parsedUserId: number | null = null;
      try {
        const rawUserData = localStorage.getItem("user_data");
        const parsedUser = rawUserData ? JSON.parse(rawUserData) as { id?: number; ID?: number } : {};
        const value = Number(parsedUser.id ?? parsedUser.ID);
        parsedUserId = Number.isFinite(value) ? value : null;
      } catch {
        parsedUserId = null;
      }

      const draftPromise = api.get<DraftListResponse>("/api/admin/drafts");

      const publishedPromise = Promise.allSettled(
        Array.from(new Set(defaultSubcategories)).map((subcategory) =>
          api.get<RawQuestion[]>(`/api/test/topic/${encodeURIComponent(subcategory)}`)
        )
      );

      const [draftResult, publishedResult] = await Promise.allSettled([draftPromise, publishedPromise]);

      const collected: ProfessorQuestionItem[] = [];
      const errors: string[] = [];

      if (draftResult.status === "fulfilled") {
        const draftRows = Array.isArray(draftResult.value.data?.drafts) ? draftResult.value.data.drafts : [];
        draftRows.forEach((question) => {
          if (typeof question.ID === "number") {
            collected.push({
              id: question.ID,
              title: String(question.QUESTION_TEXT || `Draft #${question.ID}`),
              category: String(question.CATEGORY || "General"),
              subcategory: String(question.SUBCATEGORY || "General"),
              status: "Draft",
            });
          }
        });
      } else if (!(isAxiosError(draftResult.reason) && draftResult.reason.response?.status === 404)) {
        errors.push("Failed to load draft questions.");
      }

      if (publishedResult.status === "fulfilled") {
        const merged: RawQuestion[] = [];
        publishedResult.value.forEach((result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value.data)) {
            merged.push(...result.value.data);
          }
        });

        const dedupedById = new Map<number, RawQuestion>();
        merged.forEach((question) => {
          if (typeof question.ID === "number") {
            dedupedById.set(question.ID, question);
          }
        });

        Array.from(dedupedById.values()).forEach((question) => {
          const ownerId = Number(question.OWNER_ID);
          if (parsedUserId !== null && Number.isFinite(ownerId) && ownerId !== parsedUserId) {
            return;
          }

          collected.push({
            id: question.ID,
            title: String(question.QUESTION_TEXT || `Question #${question.ID}`),
            category: String(question.CATEGORY || "General"),
            subcategory: String(question.SUBCATEGORY || "General"),
            status: "Published",
          });
        });
      } else {
        errors.push("Failed to load published questions.");
      }

      const dedupedById = new Map<number, ProfessorQuestionItem>();
      collected.forEach((item) => {
        const existing = dedupedById.get(item.id);
        if (!existing) {
          dedupedById.set(item.id, item);
          return;
        }

        if (existing.status === "Published" && item.status === "Draft") {
          dedupedById.set(item.id, item);
        }
      });

      setQuestions(Array.from(dedupedById.values()));
      setError(errors.length > 0 ? errors[0] : "");
      setIsLoading(false);
    };

    fetchProfessorQuestions();
  }, [isProfessor]);

  const filteredQuestions = useMemo(() => {
    const sorted = [...questions];

    if (filterMode === "oldest") {
      sorted.sort((first, second) => first.id - second.id);
      return sorted;
    }

    if (filterMode === "drafts") {
      return sorted
        .filter((item) => item.status === "Draft")
        .sort((first, second) => second.id - first.id);
    }

    if (filterMode === "published") {
      return sorted
        .filter((item) => item.status === "Published")
        .sort((first, second) => second.id - first.id);
    }

    sorted.sort((first, second) => second.id - first.id);
    return sorted;
  }, [questions, filterMode]);

  const handlePreviewQuestion = async (questionId: number) => {
    setPreviewError("");
    setPreviewLoadingId(questionId);

    try {
      const response = await api.get<RawQuestion>(`/api/admin/problems/${questionId}`);
      setPreviewQuestion(response.data);
    } catch {
      setPreviewError("Failed to load question preview.");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleOpenInDraftEditor = (question: ProfessorQuestionItem) => {
    const paramName = question.status === "Published" ? "publishedId" : "draftId";
    navigate(`/professor-drafts?${paramName}=${question.id}`);
  };

  const previewQuestionType = normalizeQuestionType(previewQuestion?.TYPE);
  const previewQuestionHtml = useMemo(
    () => DOMPurify.sanitize(String(previewQuestion?.QUESTION_TEXT || "")),
    [previewQuestion?.QUESTION_TEXT]
  );
  const previewAnswers = useMemo(() => {
    if (!Array.isArray(previewQuestion?.answers)) {
      return [];
    }

    return [...previewQuestion.answers]
      .map((answer, index) => {
        const parsedRank = Number(answer.RANK);
        return {
          text: String(answer.TEXT || ""),
          isCorrect:
            previewQuestionType === "Ranked Choice" || previewQuestionType === "Drag and Drop"
              ? true
              : parseAnswerCorrectness(answer.IS_CORRECT_ANSWER),
          rank: Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : index + 1,
          placement: String(answer.PLACEMENT || "").trim(),
        };
      })
      .filter((answer) => answer.text.trim().length > 0)
      .sort((first, second) => first.rank - second.rank);
  }, [previewQuestion?.answers, previewQuestionType]);

  if (!isProfessor) {
    return null;
  }

  return (
    <div className="p-6 sm:p-8 md:p-10">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value as FilterMode)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-gray-100"
          >
            <option value="recent">Recently Added</option>
            <option value="oldest">Oldest Added</option>
            <option value="drafts">Drafts Only</option>
            <option value="published">Published Only</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-gray-600">Loading your questions...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-gray-600">No questions found for this professor account.</div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-200">
              {filteredQuestions.map((question) => (
                <div key={question.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                        question.status === "Draft"
                          ? "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300"
                          : "bg-green-100 text-green-800 border-green-300"
                      }`}
                    >
                      {question.status}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base text-gray-900 truncate">
                        {question.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        #{question.id} • {question.category} / {question.subcategory}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewQuestion(question.id)}
                      disabled={previewLoadingId === question.id}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      title="Preview question"
                      aria-label={`Preview question ${question.id}`}
                    >
                      {previewLoadingId === question.id ? "…" : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenInDraftEditor(question)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      title="Open in draft editor"
                      aria-label={`Edit question ${question.id}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {previewError && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {previewError}
          </div>
        )}

        {previewQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-4 rounded-t-xl">
                <div>
                  <h2 className="text-lg font-semibold text-blue-900">Question Preview</h2>
                  <p className="text-xs text-gray-500">#{previewQuestion.ID} • {previewQuestion.CATEGORY || "General"} / {previewQuestion.SUBCATEGORY || "General"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewQuestion(null)}
                  className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 bg-gray-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 bg-white rounded-lg border border-gray-200">
                  <div className="flex flex-col sm:flex-row justify-between mb-2 text-sm sm:text-lg md:text-xl">
                    <p className="text-gray-600">Section {previewQuestion.SECTION || "—"}</p>
                    <p className="font-medium">Question 1 of 1</p>
                  </div>

                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {previewQuestion.CATEGORY || "Category"} <span className="text-yellow-600">&gt;</span>{" "}
                    {previewQuestion.SUBCATEGORY || "Subcategory"}
                    <span className="block text-sm sm:text-base md:text-lg text-gray-500 font-normal mt-1 sm:mt-0">
                      (Credit: {previewQuestion.AUTHOR_EXAM_ID || "Professor"})
                    </span>
                  </h1>

                  <h2 className="text-lg font-semibold mb-2">Question 1 of 1</h2>

                  <div className="text-base sm:text-lg md:text-xl font-medium mb-4 text-gray-800 leading-relaxed whitespace-pre-wrap [&_pre]:bg-gray-100 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm">
                    {previewQuestion.QUESTION_TEXT?.trim().length
                      ? parse(previewQuestionHtml)
                      : <span className="text-gray-500">Nothing to preview yet.</span>}
                  </div>

                  {(previewQuestionType === "Multiple Choice" || previewQuestionType === "Select All That Apply") && (
                    <div className="space-y-3 mb-2">
                      {previewAnswers.map((answer, index) => (
                        <label
                          key={`${answer.rank}-${index}`}
                          className="block p-3 sm:p-4 rounded-lg border bg-white border-gray-300 text-sm sm:text-base md:text-lg"
                        >
                          <input
                            type={previewQuestionType === "Select All That Apply" ? "checkbox" : "radio"}
                            defaultChecked={answer.isCorrect}
                            disabled
                            className="mr-3"
                          />
                          {answer.text}
                        </label>
                      ))}
                    </div>
                  )}

                  {previewQuestionType === "Fill in the Blanks" && (
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

                  {previewQuestionType === "Ranked Choice" && (
                    <div className="space-y-2 mb-2">
                      {previewAnswers.map((answer, index) => (
                        <div key={`${answer.rank}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 bg-white">
                          <span className="text-sm font-semibold text-gray-600 w-6">{index + 1}.</span>
                          <span className="text-sm sm:text-base md:text-lg text-gray-800">{answer.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {previewQuestionType === "Drag and Drop" && (
                    <div className="space-y-2 mb-2">
                      {previewAnswers.map((answer, index) => (
                        <div key={`${answer.rank}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-300 bg-white">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessorDashboard;
