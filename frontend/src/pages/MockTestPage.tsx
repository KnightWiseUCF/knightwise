////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          MockTestPage.tsx
//  Description:   Mock Test page component
//
//  Dependencies:  react
//                 api instance
//                 Layout component
//                 MockTestInfo component
//                 FillInTheBlank component
//                 SelectAllThatApply component
//                 MockTestResult component
//                 models (Question, MockTestResponse)
//
////////////////////////////////////////////////////////////////

import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import MockTestInfo from "../components/MockTestInfo";
import MockTestResult from "../components/MockTestResult";
import MultipleChoice from "../components/MultipleChoice";
import FillInTheBlank from "../components/FillInTheBlank";
import SelectAllThatApply from "../components/SelectAllThatApply";
import RankedChoice from "../components/RankedChoice";
import DragAndDrop from "../components/DragAndDrop";
import Programming from "../components/Programming";
import api from "../api";
import { Question, MockTestResponse } from "../models";

const MockTestPage: React.FC = () => {
  const [step, setStep] = useState<"info" | "test" | "result">("info");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [droppedAnswers, setDroppedAnswers] = useState<Record<string, string>>({});
  const [sectionScores, setSectionScores] = useState<
    Record<string, { correct: number; total: number }>
  >({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [pointsPossible, setPointsPossible] = useState<number | null>(null);
  const [normalizedScore, setNormalizedScore] = useState<number | null>(null);
  const [programmingAnswer, setProgrammingAnswer] = useState("");
  const [programmingLanguage, setProgrammingLanguage] = useState("C");
  const programmingLanguageIds: Record<string, number> = {
    C: 50,
    Java: 62,
    Python: 71,
  };

  const normalizeQuestionType = (
    type?: string
  ): Question["QUESTION_TYPE"] => {
    switch (type) {
      case "Multiple Choice":
        return "multiple_choice";
      case "Fill in the Blanks":
        return "fill_in_blank";
      case "Select All That Apply":
        return "select_all_that_apply";
      case "Ranked Choice":
        return "ranked_choice";
      case "Drag and Drop":
        return "drag_and_drop";
      case "Programming":
        return "programming";
      default:
        return undefined;
    }
  };

  useEffect(() => {
    const fetchMockTestProblems = async () => {
      try {
        const res = await api.get<MockTestResponse>("/api/test/mocktest");
        const data = res.data;

        const withOptions = data.questions
          .map((question) => {
          // Extract answer data
          const correctAnswer = question.answers?.find((a) => a.IS_CORRECT_ANSWER);
          const normalizedType = normalizeQuestionType(question.TYPE);
          const allAnswerTexts = question.answers?.map((a) => a.TEXT) || [];
          
          // For ranked_choice: sort answers by RANK field
          const correctOrder = normalizedType === "ranked_choice"
            ? [...(question.answers || [])]
              .sort((a, b) => (a.RANK ?? 0) - (b.RANK ?? 0))
              .map((a) => a.TEXT)
            : undefined;
          
          // Shuffle options for most types (except ranked_choice and drag_and_drop which maintain order)
          const shuffledOptions = normalizedType === "ranked_choice"
            ? correctOrder || []
            : normalizedType === "drag_and_drop"
            ? allAnswerTexts.sort(() => 0.5 - Math.random())
            : allAnswerTexts.sort(() => 0.5 - Math.random());

          // Transform RawQuestion to Question interface
          const newQuestion: Question = {
            ID:             question.ID,
            TYPE:           question.TYPE,
            SECTION:        question.SECTION,
            CATEGORY:       question.CATEGORY,
            SUBCATEGORY:    question.SUBCATEGORY,
            AUTHOR_EXAM_ID: question.AUTHOR_EXAM_ID,
            POINTS_POSSIBLE: question.POINTS_POSSIBLE,
            QUESTION_TEXT:  question.QUESTION_TEXT,
            OWNER_ID:       question.OWNER_ID,
            answerCorrect:  normalizedType === "ranked_choice"
              ? (correctOrder || []).join(", ")
              : correctAnswer?.TEXT || "",
            options:        shuffledOptions,
            QUESTION_TYPE:  normalizedType,
            correctOrder:   correctOrder,            // drag_and_drop (new placement-based): store full answer objects with placement field
            answerObjects:  normalizedType === "drag_and_drop"
              ? question.answers || []
              : undefined,            // drag_and_drop: map each answer to a drop zone with id and correctAnswer
            dropZones:      normalizedType === "drag_and_drop"
              ? [...(question.answers || [])].map((ans, idx) => ({
                  id: `zone-${idx}`,
                  correctAnswer: ans.TEXT,
                }))
              : undefined,
            // programming: use standard languages (C, Java, Python)
            problem:        normalizedType === "programming"
              ? {
                  description: question.QUESTION_TEXT,
                  languages: ["C", "Java", "Python"],
                }
              : undefined,
            problemCode:    normalizedType === "programming"
              ? (question.answers || []).reduce((acc, ans) => {
                  acc[ans.TEXT] = { code: ans.IS_CORRECT_ANSWER ? "// Solution" : "// Code", output: "" };
                  return acc;
                }, {} as { [lang: string]: { code: string; output?: string } })
              : undefined,
          };
          return newQuestion;
        })
          .filter(
            (question): question is Question =>
              question.QUESTION_TYPE !== undefined
          );

        setQuestions(withOptions);
        setSectionScores({});
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setSelectedAnswers([]);
        setSelectedOrder([]);
        setDroppedAnswers({});
        setShowFeedback(false);
        setIsCorrectAnswer(false);
        setGradingFeedback("");
        setPointsEarned(null);
        setPointsPossible(null);
        setNormalizedScore(null);
        setProgrammingAnswer("");
        setProgrammingLanguage("C");
      } 
      catch 
      {
        console.error("Failed to load mock test problems");
      }
    };

    if (step === "test") {
      fetchMockTestProblems();
    }
  }, [step]);

  const current = questions[currentIndex];
  const questionType = current?.QUESTION_TYPE || 'multiple_choice';

  useEffect(() => {
    if (questionType === "ranked_choice" && current) {
      setSelectedOrder(current.options);
    } else if (questionType === "drag_and_drop" && current) {
      setDroppedAnswers({});
    }
  }, [currentIndex, questionType, current?.options]);

  const buildUserAnswer = () => {
    switch (questionType) {
      case "multiple_choice":
      case "fill_in_blank":
        return selectedAnswer?.trim() || "";
      case "select_all_that_apply":
        return selectedAnswers;
      case "ranked_choice":
        return selectedOrder;
      case "drag_and_drop":
        return Object.entries(droppedAnswers).reduce((acc, [key, answer]) => {
          if (answer) {
            // Extract placement from key (e.g., "6_0" -> "6")
            const placement = key.split('_').slice(0, -1).join('_');
            const answerText = typeof answer === "string" ? answer : String(answer);
            if (answerText.length > 0) {
              acc[answerText] = placement;
            }
          }
          return acc;
        }, {} as Record<string, string>);
      case "programming":
        return { language: programmingLanguage, code: programmingAnswer };
      default:
        return "";
    }
  };

  const handleSubmit = async () => {
    if (!current || isSubmitting) return;

    const hasAnswer = questionType === "multiple_choice" || questionType === "fill_in_blank"
      ? selectedAnswer?.trim()
      : questionType === "ranked_choice"
        ? selectedOrder.length === (current?.options.length || 0)
        : questionType === "drag_and_drop"
          ? Object.keys(droppedAnswers).length > 0
          : questionType === "programming"
            ? programmingAnswer.trim().length > 0
            : selectedAnswers.length > 0;

    if (!hasAnswer) return;

    // Disable submit button (prevents spam)
    setIsSubmitting(true);

    if (questionType === "programming") {
      const languageId = programmingLanguageIds[programmingLanguage];
      const token = localStorage.getItem("token");

      setGradingFeedback("");
      setPointsEarned(null);
      setPointsPossible(null);
      setNormalizedScore(null);

      if (!languageId) {
        setIsSubmitting(false);
        return;
      }

      try {
        const result = await api.post(
          "/api/code/submitCode",
          {
            problemId: current.ID,
            code: programmingAnswer,
            languageId,
          },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );

        const data = result.data;
        const isCorrect = data.success ? data.correct : false;
        setIsCorrectAnswer(isCorrect);

        const section = current.SECTION;
        setSectionScores((prev) => ({
          ...prev,
          [section]: {
            correct: (prev[section]?.correct || 0) + (isCorrect ? 1 : 0),
            total: (prev[section]?.total || 0) + 1,
          },
        }));
      } catch {
        console.error("Failed to submit programming response");
      }

      setShowFeedback(true);
      setIsSubmitting(false);
      return;
    }

    const userAnswer = buildUserAnswer();
    const token = localStorage.getItem("token");

    try
    {
      const result = await api.post(
        "/api/test/submit",
        {
          problem_id: current.ID,
          userAnswer,
          category: current.CATEGORY,
          topic: current.SUBCATEGORY,
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const isCorrect = result.data.isCorrect;
      setIsCorrectAnswer(isCorrect);
      setGradingFeedback(result.data.feedback || "");
      setPointsEarned(
        typeof result.data.pointsEarned === "number" ? result.data.pointsEarned : null
      );
      setPointsPossible(
        typeof result.data.pointsPossible === "number" ? result.data.pointsPossible : null
      );
      setNormalizedScore(
        typeof result.data.normalizedScore === "number" ? result.data.normalizedScore : null
      );

      const section = current.SECTION;
      setSectionScores((prev) => ({
        ...prev,
        [section]: {
          correct: (prev[section]?.correct || 0) + (isCorrect ? 1 : 0),
          total: (prev[section]?.total || 0) + 1,
        },
      }));
    }
    catch
    {
      console.error("Failed to submit mock test response");
    }

    setShowFeedback(true);
    setIsSubmitting(false); // Re-enable submit button
  };

  const handleNext = () => {
    if (currentIndex + 1 === questions.length) {
      setStep("result");
    } else {
      setSelectedAnswer(null);
      setSelectedAnswers([]);
      setSelectedOrder([]);
      setDroppedAnswers({});
      setShowFeedback(false);
      setIsSubmitting(false);
      setIsCorrectAnswer(false);
      setGradingFeedback("");
      setPointsEarned(null);
      setPointsPossible(null);
      setNormalizedScore(null);
      setProgrammingAnswer("");
      setProgrammingLanguage("C");
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const restartTest = () => {
    setStep("info");
    setQuestions([]);
    setSectionScores({});
    setCurrentIndex(0);
  };

  return (
    <Layout>
      {step === "info" && <MockTestInfo onStart={() => setStep("test")} />}

      <div className="pb-16">
        {step === "test" && current && (
        questionType === 'multiple_choice' ? (
          <MultipleChoice
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
            showFeedback={showFeedback}
            isCorrect={isCorrectAnswer}
            feedbackText={gradingFeedback}
            pointsEarned={pointsEarned}
            pointsPossible={pointsPossible}
            normalizedScore={normalizedScore}
          />
        ) : questionType === 'ranked_choice' ? (
          <RankedChoice
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
            showFeedback={showFeedback}
            isCorrect={isCorrectAnswer}
            feedbackText={gradingFeedback}
            pointsEarned={pointsEarned}
            pointsPossible={pointsPossible}
            normalizedScore={normalizedScore}
          />
        ) : questionType === 'drag_and_drop' ? (
          <DragAndDrop
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            droppedAnswers={droppedAnswers}
            setDroppedAnswers={setDroppedAnswers}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
            showFeedback={showFeedback}
            isCorrect={isCorrectAnswer}
            feedbackText={gradingFeedback}
            pointsEarned={pointsEarned}
            pointsPossible={pointsPossible}
            normalizedScore={normalizedScore}
          />
        ) : questionType === 'programming' ? (
          <Programming
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            editorContent={programmingAnswer}
            setEditorContent={setProgrammingAnswer}
            selectedLanguage={programmingLanguage}
            setSelectedLanguage={setProgrammingLanguage}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
          />
        ) : questionType === 'select_all_that_apply' ? (
          <SelectAllThatApply
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            selectedAnswers={selectedAnswers}
            setSelectedAnswers={setSelectedAnswers}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
            showFeedback={showFeedback}
            isCorrect={isCorrectAnswer}
            feedbackText={gradingFeedback}
            pointsEarned={pointsEarned}
            pointsPossible={pointsPossible}
            normalizedScore={normalizedScore}
          />
        ) : (
          <FillInTheBlank
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            handleSubmit={handleSubmit}
            handleNext={handleNext}
            showFeedback={showFeedback}
            isCorrect={isCorrectAnswer}
            feedbackText={gradingFeedback}
            pointsEarned={pointsEarned}
            pointsPossible={pointsPossible}
            normalizedScore={normalizedScore}
          />
        )
      )}

        {step === "result" && (
          <MockTestResult sectionScores={sectionScores} onRetry={restartTest} />
        )}
      </div>
    </Layout>
  );
};

export default MockTestPage;
