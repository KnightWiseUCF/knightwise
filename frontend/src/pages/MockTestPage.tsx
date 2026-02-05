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
//                 MockTestProblem component
//                 MockTestResult component
//                 models (Question, MockTestResponse)
//
////////////////////////////////////////////////////////////////

import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import MockTestInfo from "../components/MockTestInfo";
import MockTestProblem from "../components/MockTestProblem";
import MockTestResult from "../components/MockTestResult";
import api from "../api";
import { Question, MockTestResponse } from "../models";

const MockTestPage: React.FC = () => {
  const [step, setStep] = useState<"info" | "test" | "result">("info");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [sectionScores, setSectionScores] = useState<
    Record<string, { correct: number; total: number }>
  >({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMockTestProblems = async () => {
      try {
        const res = await api.get<MockTestResponse>("/api/test/mocktest");
        const data = res.data;

        const withOptions = data.questions.map((question) => {
          const correctAnswer = question.answers?.find((a) => a.IS_CORRECT_ANSWER);
          const allAnswerTexts = question.answers?.map((a) => a.TEXT) || [];
          const shuffledOptions = allAnswerTexts.sort(() => 0.5 - Math.random());

          return {
            ID:             question.ID,
            SECTION:        question.SECTION,
            CATEGORY:       question.CATEGORY,
            SUBCATEGORY:    question.SUBCATEGORY,
            AUTHOR_EXAM_ID: question.AUTHOR_EXAM_ID,
            QUESTION_TEXT:  question.QUESTION_TEXT,
            answerCorrect:  correctAnswer?.TEXT || "",
            options:        shuffledOptions,
          };
        });

        setQuestions(withOptions);
        setSectionScores({});
        setCurrentIndex(0);
        setSelectedAnswer(null);
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

  const isCorrect =
    selectedAnswer?.trim().toLowerCase() ===
    current?.answerCorrect?.trim().toLowerCase();

  const handleSubmit = async () => {
    if (!selectedAnswer || !current || isSubmitting) return;

    // Disable submit button (prevents spam)
    setIsSubmitting(true);

    const section = current.SECTION;
    setSectionScores((prev) => ({
      ...prev,
      [section]: {
        correct: (prev[section]?.correct || 0) + (isCorrect ? 1 : 0),
        total: (prev[section]?.total || 0) + 1,
      },
    }));

    // Submit to database
    try
    {
      await api.post('/api/test/submit',
      {
        problem_id: current.ID,
        isCorrect,
        category: current.CATEGORY,
        topic: current.SUBCATEGORY,
      });
    }
    catch
    {
      console.error('Failed to submit mock test response');
    }

    setShowFeedback(true);
    setIsSubmitting(false); // Re-enable submit button
  };

  const handleNext = () => {
    if (currentIndex + 1 === questions.length) {
      setStep("result");
    } else {
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsSubmitting(false);
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
        <MockTestProblem
          current={current}
          currentIndex={currentIndex}
          total={questions.length}
          selectedAnswer={selectedAnswer}
          setSelectedAnswer={setSelectedAnswer}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          isSubmitting={isSubmitting}
        />
      )}

      {step === "result" && (
        <MockTestResult sectionScores={sectionScores} onRetry={restartTest} />
      )}
    </Layout>
  );
};

export default MockTestPage;
