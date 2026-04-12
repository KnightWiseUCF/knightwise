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
//                 axios (isAxiosError)
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useMemo, useState, useRef } from "react";
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
import { Question, RawQuestion } from "../models";
import { isAxiosError } from "axios";
import { ALL_TOPICS } from "../utils/topicLabels";

const DEFAULT_SELECTED_TOPICS = ["InputOutput", "Branching", "Loops", "Variables"];
const DEFAULT_QUESTION_COUNT = 12;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 50;
const DEFAULT_TIME_LIMIT_MINUTES = 30;
const MIN_TIME_LIMIT_MINUTES = 5;
const MAX_TIME_LIMIT_MINUTES = 180;

const shuffleArray = <T,>(items: T[]): T[] => [...items].sort(() => 0.5 - Math.random());

const clampTimeLimit = (minutes: number): number => {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_TIME_LIMIT_MINUTES;
  }

  return Math.min(MAX_TIME_LIMIT_MINUTES, Math.max(MIN_TIME_LIMIT_MINUTES, Math.round(minutes)));
};

const clampQuestionCount = (count: number): number => {
  if (!Number.isFinite(count)) {
    return DEFAULT_QUESTION_COUNT;
  }

  return Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, Math.round(count)));
};

const toApiTopicSlug = (topic: string): string => {
  const normalized = String(topic || "").trim();
  return normalized === "Input/Output" ? "InputOutput" : normalized;
};

const normalizeQuestionType = (
  type?: string
): Question["QUESTION_TYPE"] => {
  const normalized = (type || "").trim().toLowerCase();

  switch (normalized) {
    case "multiple choice":
      return "multiple_choice";
    case "fill in the blanks":
      return "fill_in_blank";
    case "select all that apply":
      return "select_all_that_apply";
    case "ranked choice":
      return "ranked_choice";
    case "drag and drop":
      return "drag_and_drop";
    case "programming":
      return "programming";
    default:
      return undefined;
  }
};

const toQuestion = (question: RawQuestion): Question | null => {
  const correctAnswer = question.answers?.find((answer) => answer.IS_CORRECT_ANSWER);
  const normalizedType = normalizeQuestionType(question.TYPE);
  const allAnswerTexts = question.answers?.map((answer) => answer.TEXT) || [];

  const correctOrder = normalizedType === "ranked_choice"
    ? [...(question.answers || [])]
      .sort((left, right) => (left.RANK ?? 0) - (right.RANK ?? 0))
      .map((answer) => answer.TEXT)
    : undefined;

  const shuffledOptions = shuffleArray(allAnswerTexts);

  if (!normalizedType) {
    return null;
  }

  return {
    ID: question.ID,
    TYPE: question.TYPE,
    SECTION: question.SECTION,
    CATEGORY: question.CATEGORY,
    SUBCATEGORY: question.SUBCATEGORY,
    AUTHOR_EXAM_ID: question.AUTHOR_EXAM_ID,
    POINTS_POSSIBLE: question.POINTS_POSSIBLE,
    QUESTION_TEXT: question.QUESTION_TEXT,
    OWNER_ID: question.OWNER_ID,
    answerCorrect: normalizedType === "ranked_choice"
      ? (correctOrder || []).join(", ")
      : correctAnswer?.TEXT || "",
    options: shuffledOptions,
    QUESTION_TYPE: normalizedType,
    correctOrder,
    answerObjects: normalizedType === "drag_and_drop" ? question.answers || [] : undefined,
    dropZones: normalizedType === "drag_and_drop"
      ? [...(question.answers || [])].map((answer, index) => ({
          id: `zone-${index}`,
          correctAnswer: answer.TEXT,
        }))
      : undefined,
    problem: normalizedType === "programming"
      ? {
          description: question.QUESTION_TEXT,
          languages: ["C", "C++", "Java", "Python"],
        }
      : undefined,
    problemCode: normalizedType === "programming"
      ? (question.answers || []).reduce((accumulator, answer) => {
          accumulator[answer.TEXT] = {
            code: answer.IS_CORRECT_ANSWER ? "// Solution" : "// Code",
            output: "",
          };
          return accumulator;
        }, {} as { [language: string]: { code: string; output?: string } })
      : undefined,
  };
};

const MockTestPage: React.FC = () => {
  const isProfessorAccount = localStorage.getItem("account_type") === "professor";
  const [step, setStep] = useState<"info" | "test" | "result">("info");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(DEFAULT_SELECTED_TOPICS);
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_QUESTION_COUNT);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(DEFAULT_TIME_LIMIT_MINUTES);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(DEFAULT_TIME_LIMIT_MINUTES * 60);
  const [isPreparingTest, setIsPreparingTest] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [completionReason, setCompletionReason] = useState<"completed" | "time_limit">("completed");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [droppedAnswers, setDroppedAnswers] = useState<Record<string, string>>({});
  const [subcategoryScores, setSubcategoryScores] = useState<
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
  const [passedTests, setPassedTests] = useState<number | null>(null);
  const [totalTests, setTotalTests] = useState<number | null>(null);
  const [progSubmitsRemaining, setProgSubmitsRemaining] = useState<number | null>(null);
  const startTimeRef = useRef<number>(Date.now()); // Ref so we don't need to re-render on change
  const programmingLanguageIds: Record<string, number> = {
    C: 50,
    "C++": 54,
    Java: 62,
    Python: 71,
  };

  useEffect(() => {
    if (step !== "test") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimeRemainingSeconds((previous) => {
        if (previous <= 1) {
          window.clearInterval(intervalId);
          setCompletionReason("time_limit");
          setStep("result");
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [step]);

  const subcategoryTotals = useMemo(() => {
    return questions.reduce<Record<string, number>>((accumulator, question) => {
      accumulator[question.SUBCATEGORY] = (accumulator[question.SUBCATEGORY] || 0) + 1;
      return accumulator;
    }, {});
  }, [questions]);

  const formattedTimeRemaining = useMemo(() => {
    const minutes = Math.floor(timeRemainingSeconds / 60);
    const seconds = timeRemainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeRemainingSeconds]);

  const current = questions[currentIndex] ?? null;
  const questionType = current?.QUESTION_TYPE || 'multiple_choice';

  useEffect(() => {
    // On question change, start the timer
    startTimeRef.current = Date.now(); 
    if (questionType === "ranked_choice" && current?.options) {
      setSelectedOrder(current.options);
    } else if (questionType === "drag_and_drop") {
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

  const resetInteractionState = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setSelectedAnswers([]);
    setSelectedOrder([]);
    setDroppedAnswers({});
    setSubcategoryScores({});
    setShowFeedback(false);
    setIsSubmitting(false);
    setIsCorrectAnswer(false);
    setGradingFeedback("");
    setPointsEarned(null);
    setPointsPossible(null);
    setNormalizedScore(null);
    setProgrammingAnswer("");
    setProgrammingLanguage("C");
  };

  const handleToggleTopic = (topic: string) => {
    setSetupError("");
    setSelectedTopics((previous) =>
      previous.includes(topic)
        ? previous.filter((entry) => entry !== topic)
        : [...previous, topic]
    );
  };

  const handleStart = async () => {
    if (selectedTopics.length === 0) {
      setSetupError("Select at least one topic to build a mock test.");
      return;
    }

    setIsPreparingTest(true);
    setSetupError("");

    try {
      const settledTopicResponses = await Promise.allSettled(
        selectedTopics.map(async (topic) => {
          const topicSlug = toApiTopicSlug(topic);
          const response = await api.get<RawQuestion[]>(`/api/test/topic/${encodeURIComponent(topicSlug)}`);
          return { topic, questions: response.data };
        })
      );

      const topicQuestions = new Map<string, RawQuestion[]>();

      for (const response of settledTopicResponses) {
        if (response.status !== "fulfilled") {
          continue;
        }

        const shuffledQuestions = shuffleArray(Array.isArray(response.value.questions) ? response.value.questions : []);
        if (shuffledQuestions.length > 0) {
          topicQuestions.set(response.value.topic, shuffledQuestions);
        }
      }

      const usedQuestionIds = new Set<number>();
      const assembledQuestions: RawQuestion[] = [];
      const overflowQuestions: RawQuestion[] = [];
      const targetQuestionCount = clampQuestionCount(questionCount);

      for (const topic of selectedTopics) {
        if (assembledQuestions.length >= targetQuestionCount) {
          break;
        }

        const questionsForTopic = topicQuestions.get(topic) || [];
        const firstUnusedQuestion = questionsForTopic.find((question) => !usedQuestionIds.has(question.ID));

        if (firstUnusedQuestion) {
          assembledQuestions.push(firstUnusedQuestion);
          usedQuestionIds.add(firstUnusedQuestion.ID);
        }

        for (const question of questionsForTopic) {
          if (!usedQuestionIds.has(question.ID)) {
            overflowQuestions.push(question);
          }
        }
      }

      for (const question of shuffleArray(overflowQuestions)) {
        if (assembledQuestions.length >= targetQuestionCount) {
          break;
        }

        if (usedQuestionIds.has(question.ID)) {
          continue;
        }

        assembledQuestions.push(question);
        usedQuestionIds.add(question.ID);
      }

      const preparedQuestions = shuffleArray(assembledQuestions)
        .map(toQuestion)
        .filter((question): question is Question => question !== null);

      // Ensure that a user is served a maximum of 
      // one programming question in the entire mock test.
      let programmingQuestionUsed = false;
      const filteredQuestions = preparedQuestions.filter(q => {
        if (q.QUESTION_TYPE !== "programming") return true;
        if (programmingQuestionUsed) return false;
        programmingQuestionUsed = true;
        return true;
      });

      if (filteredQuestions.length === 0) {
        setSetupError("No published questions were available for the selected topics.");
        return;
      }

      // Check and set how many programming submissions
      // the user has left for the day.
      // The filtering for one programming question
      // is already done at this point, so this
      // is just done for the "come back tomorrow" message.
      const token = localStorage.getItem("token");
      try 
      {
        const limitRes = await api.get(
          "/api/code/canSubmit",
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        setProgSubmitsRemaining(limitRes.data.remaining);
      } 
      catch 
      {
        // Just set the questions normally
      }

      setQuestions(filteredQuestions);
      resetInteractionState();
      setTimeRemainingSeconds(clampTimeLimit(timeLimitMinutes) * 60);
      setCompletionReason("completed");
      startTimeRef.current = Date.now(); // Reset timer on test start
      setStep("test");
    } catch (error) {
      console.error("Failed to prepare custom mock test", error);
      setSetupError("Unable to prepare the mock test right now. Please try again.");
    } finally {
      setIsPreparingTest(false);
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

    // Stop timer (compute elapsed time in seconds)
    const elapsedTime = Math.round((Date.now() - startTimeRef.current) / 1000);

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
            isTestRun: false,
            elapsedTime,
          },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );

        const data = result.data;

        // Decrement remaining submits
        // Backend counts all submits toward daily limit,
        // regardless of correct/incorrect/error,
        // as long as the response is a 200.
        setProgSubmitsRemaining(prev => prev !== null ? prev - 1 : null);

        const isCorrect = data.success ? data.allPassed : false;
        setIsCorrectAnswer(isCorrect);

        // Set these outside if/else since backend always returns them
        setTotalTests(data.totalTests ?? 0);
        setPointsPossible(typeof data.pointsPossible === "number" ? data.pointsPossible : null);

        if (data.success) 
        {
          const passed = data.passedTests ?? 0;
          const label = data.allPassed ? "Correct!" : passed > 0 ? "Not quite!" : "Incorrect.";
          setGradingFeedback(label);
          setPassedTests(passed);
          setPointsEarned(typeof data.pointsEarned === "number" ? data.pointsEarned : null);
        } 
        else 
        {
          const errorDetails = data.compile_output || data.stderr || data.error || "";
          setPointsEarned(0);
          setPassedTests(0);
          setGradingFeedback(`${data.status || "Source code error"}${errorDetails ? `: ${errorDetails}` : "."}`);
        }

        const subcategory = current.SUBCATEGORY;
        setSubcategoryScores((prev) => ({
          ...prev,
          [subcategory]: {
            correct: (prev[subcategory]?.correct || 0) + (isCorrect ? 1 : 0),
            total: (prev[subcategory]?.total || 0) + 1,
          },
        }));
      } 
      catch (error: unknown)
      {
        if (isAxiosError(error))
        {
          // Daily submission limit reached.
          // This should never actually be reachable since
          // the backend should stop serving programming questions to users
          // once they hit the limit. But just in case.
          if (error.response?.status === 429)
          {
            setGradingFeedback("Daily programming question submission limit exceeded. Come back tomorrow!");
          } 
          else
          {
            setGradingFeedback("Submission failed. Please try again later.");
          }
        }
        else
        {
          setGradingFeedback("Submission failed. Please try again later.");
        }
        setIsCorrectAnswer(false);
      }
      setShowFeedback(true);
      setIsSubmitting(false);
      return;
    }

    const userAnswer = buildUserAnswer();
    const token = localStorage.getItem("token");

    try
    {
      const submitConfig = token && !isProfessorAccount
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const result = await api.post(
        "/api/test/submit",
        {
          problem_id: current.ID,
          userAnswer,
          category: current.CATEGORY,
          topic: current.SUBCATEGORY,
          elapsedTime,
        },
        submitConfig
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

      const subcategory = current.SUBCATEGORY;
      setSubcategoryScores((prev) => ({
        ...prev,
        [subcategory]: {
          correct: (prev[subcategory]?.correct || 0) + (isCorrect ? 1 : 0),
          total: (prev[subcategory]?.total || 0) + 1,
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
      setCompletionReason("completed");
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
      setPassedTests(null);
      setTotalTests(null);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const restartTest = () => {
    setStep("info");
    setQuestions([]);
    resetInteractionState();
    setTimeRemainingSeconds(clampTimeLimit(timeLimitMinutes) * 60);
  };

  return (
    <Layout>
      {step === "info" && (
        <MockTestInfo
          availableTopics={[...ALL_TOPICS]}
          selectedTopics={selectedTopics}
          questionCount={questionCount}
          timeLimitMinutes={timeLimitMinutes}
          isStarting={isPreparingTest}
          errorMessage={setupError}
          onToggleTopic={handleToggleTopic}
          onSelectAll={() => {
            setSetupError("");
            setSelectedTopics([...ALL_TOPICS]);
          }}
          onClearAll={() => {
            setSetupError("");
            setSelectedTopics([]);
          }}
          onQuestionCountChange={(count) => setQuestionCount(clampQuestionCount(count))}
          onTimeLimitChange={(minutes) => setTimeLimitMinutes(clampTimeLimit(minutes))}
          onStart={handleStart}
        />
      )}

      <div className="pb-16">
        {step === "test" && current && (
          <>
            <div className="mx-auto mb-6 flex w-full max-w-6xl flex-col gap-4 rounded-3xl border border-gray-200 bg-white/95 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Custom mock test
                </p>
                <p className="mt-1 text-sm text-gray-700 sm:text-base">
                  {selectedTopics.length} topics selected • {questions.length} questions
                </p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <span className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white sm:text-base">
                  Time left {formattedTimeRemaining}
                </span>
              </div>
            </div>

            {questionType === 'multiple_choice' ? (
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
                answered={showFeedback}
                isSubmitting={isSubmitting}
                isCorrect={isCorrectAnswer}
                feedbackText={gradingFeedback}
                pointsEarned={pointsEarned}
                pointsPossible={pointsPossible}
                normalizedScore={normalizedScore}
                passedTests={passedTests}
                totalTests={totalTests}
                submissionsRemaining={progSubmitsRemaining}
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
            )}
          </>
        )}

        {step === "result" && (
          <MockTestResult
            subcategoryScores={subcategoryScores}
            subcategoryTotals={subcategoryTotals}
            completionReason={completionReason}
            onRetry={restartTest}
          />
        )}
      </div>
    </Layout>
  );
};

export default MockTestPage;
