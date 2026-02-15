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
            correctOrder:   correctOrder,
            // drag_and_drop: map each answer to a drop zone with id and correctAnswer
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

  // Determine if answer is correct based on question type
  const isCorrect = 
    questionType === 'multiple_choice'
      ? selectedAnswer === current?.answerCorrect
      : questionType === 'select_all_that_apply'
        ? selectedAnswers.length > 0 &&
          selectedAnswers.sort().join(", ") ===
          current?.answerCorrect?.split(", ").sort().join(", ")
        : questionType === 'ranked_choice'
          ? selectedOrder.length > 0 &&
            (current?.correctOrder || []).join("|") === selectedOrder.join("|")
          : questionType === 'drag_and_drop'
            // For drag_and_drop: all zones must have correct answers
            ? Object.entries(droppedAnswers).every(([zoneId, ans]) => {
                const zone = (current?.dropZones || []).find((z) => z.id === zoneId);
                return zone && ans === zone.correctAnswer;
              }) && Object.keys(droppedAnswers).length === (current?.dropZones || []).length
            : selectedAnswer?.trim().toLowerCase() ===
              current?.answerCorrect?.trim().toLowerCase();

  const handleSubmit = () => {
    if (!current) return;
    
    // Check if answer(s) provided based on question type
    const hasAnswer = questionType === 'multiple_choice' || questionType === 'fill_in_blank'
      ? selectedAnswer
      : questionType === 'ranked_choice'
        ? selectedOrder.length === (current?.options.length || 0)
        : questionType === 'drag_and_drop'
          ? (current?.dropZones || []).length > 0 && Object.keys(droppedAnswers).length === (current?.dropZones || []).length
          : selectedAnswers.length > 0;
    
    if (!hasAnswer) {
      console.warn("No answer provided for question type:", questionType);
      return;
    }

    const section = current.SECTION;
    setSectionScores((prev) => ({
      ...prev,
      [section]: {
        correct: (prev[section]?.correct || 0) + (isCorrect ? 1 : 0),
        total: (prev[section]?.total || 0) + 1,
      },
    }));
    setShowFeedback(true);
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
            isCorrect={isCorrect}
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
            isCorrect={isCorrect}
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
            isCorrect={isCorrect}
          />
        ) : questionType === 'programming' ? (
          <Programming
            current={current}
            currentIndex={currentIndex}
            total={questions.length}
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
            isCorrect={isCorrect}
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
            isCorrect={isCorrect}
          />
        )
      )}

      {step === "result" && (
        <MockTestResult sectionScores={sectionScores} onRetry={restartTest} />
      )}
    </Layout>
  );
};

export default MockTestPage;
