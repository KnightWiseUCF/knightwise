import React, { useMemo, useState } from "react";
import Layout from "../components/Layout";

type QuestionType =
  | "Multiple Choice"
  | "Fill in the Blanks"
  | "Select All That Apply"
  | "Ranked Choice"
  | "Drag and Drop";

interface Draft {
  id: string;
  title: string;
  section: string;
  category: string;
  subcategory: string;
  questionType: QuestionType;
  questionText: string;
  answers: string[];
  updatedAt: string;
}

const DRAFTS_STORAGE_KEY = "prof_question_drafts";

const emptyDraftForm: Omit<Draft, "id" | "updatedAt"> = {
  title: "",
  section: "",
  category: "",
  subcategory: "",
  questionType: "Multiple Choice",
  questionText: "",
  answers: ["", ""],
};

const loadDrafts = (): Draft[] => {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const draft = item as Partial<Draft>;
        return {
          id: typeof draft.id === "string" ? draft.id : crypto.randomUUID(),
          title: typeof draft.title === "string" ? draft.title : "Untitled Draft",
          section: typeof draft.section === "string" ? draft.section : "",
          category: typeof draft.category === "string" ? draft.category : "",
          subcategory: typeof draft.subcategory === "string" ? draft.subcategory : "",
          questionType:
            draft.questionType &&
            [
              "Multiple Choice",
              "Fill in the Blanks",
              "Select All That Apply",
              "Ranked Choice",
              "Drag and Drop",
            ].includes(draft.questionType)
              ? draft.questionType
              : "Multiple Choice",
          questionText: typeof draft.questionText === "string" ? draft.questionText : "",
          answers: Array.isArray(draft.answers)
            ? draft.answers.map((answer) => String(answer ?? ""))
            : ["", ""],
          updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString(),
        } as Draft;
      });
  } catch {
    return [];
  }
};

const saveDrafts = (drafts: Draft[]) => {
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
};

const ProfessorDraftsPage: React.FC = () => {
  const isProfessor = localStorage.getItem("account_type") === "professor";
  const [drafts, setDrafts] = useState<Draft[]>(() => loadDrafts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Draft, "id" | "updatedAt">>(emptyDraftForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const sortedDrafts = useMemo(
    () => [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts]
  );

  const resetForm = () => {
    setForm(emptyDraftForm);
    setEditingId(null);
  };

  const handleAnswerChange = (index: number, value: string) => {
    setForm((prev) => {
      const nextAnswers = [...prev.answers];
      nextAnswers[index] = value;
      return { ...prev, answers: nextAnswers };
    });
  };

  const addAnswer = () => {
    setForm((prev) => ({ ...prev, answers: [...prev.answers, ""] }));
  };

  const removeAnswer = (index: number) => {
    setForm((prev) => {
      if (prev.answers.length <= 2) return prev;
      return {
        ...prev,
        answers: prev.answers.filter((_, i) => i !== index),
      };
    });
  };

  const handleSaveDraft = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!form.questionText.trim()) {
      setError("Question text is required.");
      return;
    }

    const normalizedAnswers = form.answers.map((answer) => answer.trim()).filter(Boolean);
    if (normalizedAnswers.length < 2) {
      setError("At least 2 answers are required.");
      return;
    }

    if (editingId) {
      const updated = drafts.map((draft) =>
        draft.id === editingId
          ? {
              ...draft,
              ...form,
              answers: normalizedAnswers,
              updatedAt: new Date().toISOString(),
            }
          : draft
      );

      setDrafts(updated);
      saveDrafts(updated);
      setSuccessMessage("Draft updated.");
      resetForm();
      return;
    }

    const newDraft: Draft = {
      id: crypto.randomUUID(),
      ...form,
      answers: normalizedAnswers,
      updatedAt: new Date().toISOString(),
    };

    const updated = [newDraft, ...drafts];
    setDrafts(updated);
    saveDrafts(updated);
    setSuccessMessage("Draft created.");
    resetForm();
  };

  const handleEditDraft = (draft: Draft) => {
    setError("");
    setSuccessMessage("");
    setEditingId(draft.id);
    setForm({
      title: draft.title,
      section: draft.section,
      category: draft.category,
      subcategory: draft.subcategory,
      questionType: draft.questionType,
      questionText: draft.questionText,
      answers: draft.answers.length > 0 ? draft.answers : ["", ""],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteDraft = (id: string) => {
    const updated = drafts.filter((draft) => draft.id !== id);
    setDrafts(updated);
    saveDrafts(updated);

    if (editingId === id) {
      resetForm();
    }

    setSuccessMessage("Draft deleted.");
    setError("");
  };

  if (!isProfessor) {
    return (
      <Layout>
        <div className="p-6 sm:p-8">
          <div className="max-w-3xl mx-auto rounded-xl border border-yellow-300 bg-yellow-50 p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Question Drafts</h1>
            <p className="text-gray-700">This page is only available to professor accounts.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-gray-800">Question Drafts</h1>

          <form onSubmit={handleSaveDraft} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Draft title"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
              <select
                value={form.questionType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, questionType: event.target.value as QuestionType }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option>Multiple Choice</option>
                <option>Fill in the Blanks</option>
                <option>Select All That Apply</option>
                <option>Ranked Choice</option>
                <option>Drag and Drop</option>
              </select>
              <input
                type="text"
                value={form.section}
                onChange={(event) => setForm((prev) => ({ ...prev, section: event.target.value }))}
                placeholder="Section"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Category"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                value={form.subcategory}
                onChange={(event) => setForm((prev) => ({ ...prev, subcategory: event.target.value }))}
                placeholder="Subcategory"
                className="md:col-span-2 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <textarea
              value={form.questionText}
              onChange={(event) => setForm((prev) => ({ ...prev, questionText: event.target.value }))}
              placeholder="Write the question draft..."
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Answers</h2>
                <button
                  type="button"
                  onClick={addAnswer}
                  className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Add Answer
                </button>
              </div>

              {form.answers.map((answer, index) => (
                <div key={`${index}-${editingId ?? "new"}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={answer}
                    onChange={(event) => handleAnswerChange(index, event.target.value)}
                    placeholder={`Answer ${index + 1}`}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeAnswer(index)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    disabled={form.answers.length <= 2}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-yellow-500 px-5 py-2 font-semibold text-black hover:bg-yellow-600"
              >
                {editingId ? "Update Draft" : "Create Draft"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg bg-gray-100 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {error && <p className="text-red-600">{error}</p>}
            {successMessage && <p className="text-green-700">{successMessage}</p>}
          </form>

          <div className="space-y-3">
            {sortedDrafts.length === 0 && (
              <p className="text-gray-600">No drafts yet. Create your first draft above.</p>
            )}

            {sortedDrafts.map((draft) => (
              <div key={draft.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{draft.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {draft.section || "No section"} • {draft.category || "No category"} • {draft.subcategory || "No subcategory"}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Type: {draft.questionType}</p>
                    <p className="text-sm text-gray-600 mt-1">Answers: {draft.answers.length}</p>
                    <p className="text-sm text-gray-600 mt-1">Last updated: {new Date(draft.updatedAt).toLocaleString()}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditDraft(draft)}
                      className="rounded-lg bg-white border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="rounded-lg bg-white border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfessorDraftsPage;
