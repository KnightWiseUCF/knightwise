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
//
////////////////////////////////////////////////////////////////

import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import MockTestInfo from "../components/MockTestInfo";
import MockTestProblem from "../components/MockTestProblem";
import MockTestResult from "../components/MockTestResult";
import api from "../api";

const MockTestPage: React.FC = () => {
  const [step, setStep] = useState<"info" | "test" | "result">("info");
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [sectionScores, setSectionScores] = useState<
    Record<string, { correct: number; total: number }>
  >({});
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const fetchMockTestProblems = async () => {
      try {
        const res = await api.get("/api/test/mocktest");
        const data = res.data;

        const withOptions = data.questions.map((question: any) => {
          const correctAnswer = question.answers?.find((a: any) => a.IS_CORRECT_ANSWER);
          const allAnswerTexts = question.answers?.map((a: any) => a.TEXT) || [];
          const shuffledOptions = allAnswerTexts.sort(() => 0.5 - Math.random());

          return {
            ...question,
            answerCorrect: correctAnswer?.TEXT,
            options: shuffledOptions,
          };
        });

        setQuestions(withOptions);
        setSectionScores({});
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
      } catch (err) {
        console.error("Failed to load mock problems", err);
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

  const handleSubmit = () => {
    if (!selectedAnswer || !current) return;

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
        />
      )}

      {step === "result" && (
        <MockTestResult sectionScores={sectionScores} onRetry={restartTest} />
      )}
    </Layout>
  );
};

export default MockTestPage;
