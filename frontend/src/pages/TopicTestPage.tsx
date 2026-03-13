////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          TopicTestPage.tsx
//  Description:   Handles Topic Practice operations such as
//                 submitting user responses and displaying
//                 grading feedback.
//
//  Dependencies:  react
//                 api instance
//                 html-react-parser
//                 dompurify
//                 Layout component
//                 FillInTheBlank component
//                 SelectAllThatApply component
//                 models (RawQuestion, Question)
//                 axios (isAxiosError)
//
////////////////////////////////////////////////////////////////

// this page shows questions related to the chosen topic
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import MultipleChoice from "../components/MultipleChoice";
import FillInTheBlank from "../components/FillInTheBlank";
import SelectAllThatApply from "../components/SelectAllThatApply";
import RankedChoice from "../components/RankedChoice";
import DragAndDrop from "../components/DragAndDrop";
import Programming from "../components/Programming";
import api from "../api";
import { RawQuestion, Question } from "../models";
import { isAxiosError } from "axios";

const TopicTestPage: React.FC = () => {
  const { topicName } = useParams<{ topicName: string }>();
  const isProfessorAccount = localStorage.getItem("account_type") === "professor";
  const [problems, setProblems] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [droppedAnswers, setDroppedAnswers] = useState<Record<string, string>>({});
  const [programmingAnswer, setProgrammingAnswer] = useState("");
  const [programmingLanguage, setProgrammingLanguage] = useState("C");
  const [answered, setAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean>(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [pointsPossible, setPointsPossible] = useState<number | null>(null);
  const [normalizedScore, setNormalizedScore] = useState<number | null>(null);
  // These next three are for programming questions only
  const [passedTests, setPassedTests] = useState<number | null>(null);
  const [totalTests, setTotalTests] = useState<number | null>(null);
  const [progSubmitsRemaining, setProgSubmitsRemaining] = useState<number | null>(null);
  const navigate = useNavigate();
  const programmingLanguageIds: Record<string, number> = {
    C: 50,
    "C++": 54,
    Java: 62,
    Python: 71,
  };
  const current = problems[currentIndex];
  const questionType = current?.QUESTION_TYPE || "multiple_choice";

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

  const buildProfessorAnswerKeyFeedback = (question: Question, type: Question["QUESTION_TYPE"]) => {
    const allAnswers = question.answerObjects ?? [];

    switch (type) {
      case "multiple_choice":
      case "fill_in_blank": {
        const firstCorrect = allAnswers.find((answer) => answer.IS_CORRECT_ANSWER)?.TEXT ?? question.answerCorrect;
        return `Correct answer: ${firstCorrect || "(not available)"}.`;
      }
      case "select_all_that_apply": {
        const correctAnswers = allAnswers.filter((answer) => answer.IS_CORRECT_ANSWER).map((answer) => answer.TEXT);
        if (correctAnswers.length === 0) {
          return "No correct answers found for this question.";
        }
        return `Correct answers: ${correctAnswers.join(", ")}.`;
      }
      case "ranked_choice": {
        const ranked = question.correctOrder ?? [];
        if (ranked.length === 0) {
          return "Ranking key not available.";
        }
        return `Correct order: ${ranked.join(" → ")}.`;
      }
      case "drag_and_drop": {
        const mappings = allAnswers
          .filter((answer) => (answer.PLACEMENT ?? "").trim().length > 0)
          .map((answer) => `${answer.TEXT} → ${answer.PLACEMENT}`);
        if (mappings.length === 0) {
          return "Drag-and-drop placement key not available.";
        }
        return `Correct placements: ${mappings.join(" | ")}`;
      }
      case "programming":
        return "Programming submissions are disabled in topic practice.";
      default:
        return "Answer key unavailable for this question type.";
    }
  };

  // get question from DB
  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const res = await api.get<RawQuestion[]>(`/api/test/topic/${topicName}`);
        const data = res.data;

        // shuffle problems
        const shuffledProblems = data.sort(() => 0.5 - Math.random());

        // shuffle choices
        const withOptions = shuffledProblems
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
          
          // Shuffle options shown to users; keep correctOrder separately for grading
          const shuffledOptions = normalizedType === "ranked_choice"
            ? [...allAnswerTexts].sort(() => 0.5 - Math.random())
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
            // Keep answer objects for all question types to support local professor grading.
            answerObjects:  question.answers || [],
            // drag_and_drop (old inline style): map each answer to a drop zone with id and correctAnswer
            dropZones:      normalizedType === "drag_and_drop"
              ? [...(question.answers || [])].map((ans, idx) => ({
                  id: `zone-${idx}`,
                  correctAnswer: ans.TEXT,
                }))
              : undefined,
            // programming: use standard languages (C, C++, Java, Python)
            problem:        normalizedType === "programming"
              ? {
                  description: question.QUESTION_TEXT,
                  languages: ["C", "C++", "Java", "Python"],
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

        // Check and set how many programming submissions
        // the user has left for the day.
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
        
        setProblems(withOptions);
      } 
      catch (error: unknown)
      {
        console.error("Failed to load topic problems:", error);
        
        // Log detailed error info for debugging
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: { error?: string; message?: string }; statusText?: string } };
          console.error("Backend response:", {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
          });
        }
      }
    };

    if (topicName) fetchProblems();
  }, [topicName]);

  const buildUserAnswer = (questionType: Question["QUESTION_TYPE"]) => {
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
            // Preserve exact answer text for backend lookup, but validate trimmed content
            const answerText = typeof answer === "string" ? answer : String(answer);
            const placementText = typeof placement === "string" ? placement : String(placement);
            if (answerText.trim().length > 0 && placementText.trim().length > 0) {
              acc[answerText] = placementText.trim();
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

  // submit response and send to server
  const handleSubmit = async () => {
    // Gate submit until the current question has a valid response.
    const hasAnswer = questionType === "multiple_choice" || questionType === "fill_in_blank"
      ? selectedAnswer?.trim()
      : questionType === "ranked_choice"
        ? selectedOrder.length === (current?.options.length || 0)
        : questionType === "drag_and_drop"
          ? Object.keys(droppedAnswers).length > 0
          : questionType === "programming"
            ? programmingAnswer.trim().length > 0
            : selectedAnswers.length > 0;

    if (!current || !hasAnswer || isSubmitting) return;
    setIsSubmitting(true);

    if (questionType === "programming") {
      setPointsEarned(null);
      setPointsPossible(null);
      setNormalizedScore(null);
      const languageId = programmingLanguageIds[programmingLanguage];
      const token = localStorage.getItem("token");

      if (!languageId) {
        setFeedback("Unsupported language.");
        setIsCorrectAnswer(false);
        setAnswered(true);
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
          },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );

        const data = result.data;

        // Decrement remaining submits
        // Backend counts all submits toward daily limit,
        // regardless of correct/incorrect/error,
        // as long as the response is a 200.
        setProgSubmitsRemaining(prev => prev !== null ? prev - 1 : null);

        if (data.success) {
          // Show accepted vs incorrect based on judge response.
          const passed = data.passedTests ?? 0;
          const total = data.totalTests ?? 0;
          const label = data.allPassed ? "Correct!" : passed > 0 ? "Not quite!" : "Incorrect.";
          setFeedback(label);
          setIsCorrectAnswer(Boolean(data.allPassed));
          setPointsEarned(typeof data.pointsEarned === "number" ? data.pointsEarned : null);
          setPointsPossible(typeof data.pointsPossible === "number" ? data.pointsPossible : null);
          setPassedTests(passed);
          setTotalTests(total);
        } else {
          // Include compiler/runtime errors when present.
          const errorDetails = data.compile_output || data.stderr || data.error || "";
          setFeedback(`${data.status || "Execution failed"}${errorDetails ? `: ${errorDetails}` : ""}`);
          setIsCorrectAnswer(false);
          setPassedTests(null);
          setTotalTests(null);
        }
      } catch (error: unknown) {
        if (isAxiosError(error))
        {
          // Daily submission limit reached.
          // This should never actually be reachable since
          // the backend should stop serving programming questions to users
          // once they hit the limit. But just in case.
          if (error.response?.status === 429)
          {
            setFeedback("Daily programming question submission limit exceeded. Come back tomorrow!");
          }
          else
          {
            setFeedback("Submission failed. Please try again later.");
          }
        }
        else
        {
          setFeedback("Submission failed. Please try again later.");
        }
        setIsCorrectAnswer(false);
      }

      setAnswered(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const userAnswer = buildUserAnswer(questionType);

      // Additional validation for drag_and_drop
      if (questionType === "drag_and_drop") {
        if (typeof userAnswer !== 'object' || Array.isArray(userAnswer)) {
          console.error("Invalid drag_and_drop answer format:", userAnswer);
          setFeedback("Error: Invalid answer format for drag and drop question");
          setIsCorrectAnswer(false);
          setAnswered(true);
          setIsSubmitting(false);
          return;
        }
        
        // Ensure all values are non-empty strings
        const hasInvalidValues = Object.entries(userAnswer as Record<string, string>)
          .some(([key, value]) => {
            return !key || !value || typeof key !== 'string' || typeof value !== 'string';
          });
          
        if (hasInvalidValues) {
          console.error("Invalid key/value pairs in drag_and_drop answer:", userAnswer);
          setFeedback("Error: Some answer placements are invalid");
          setIsCorrectAnswer(false);
          setAnswered(true);
          setIsSubmitting(false);
          return;
        }
      }

      if (isProfessorAccount) {
        setFeedback(buildProfessorAnswerKeyFeedback(current, questionType));
        setIsCorrectAnswer(false);
        setPointsEarned(null);
        setPointsPossible(null);
        setNormalizedScore(null);
        setAnswered(true);
        setIsSubmitting(false);
        return;
      }

      // Sanitize data to ensure it can be safely serialized
      const payload = {
        problem_id: Number(current.ID),
        userAnswer,
        category: String(current.CATEGORY || ""),
        topic: String(current.SUBCATEGORY || ""),
      };

      // Ensure payload can be JSON serialized
      try {
        JSON.stringify(payload);
      } catch (e) {
        console.error("Payload cannot be JSON serialized:", e);
        setFeedback("Error: Unable to serialize answer data");
        setIsCorrectAnswer(false);
        setAnswered(true);
        setIsSubmitting(false);
        return;
      }

      // Get grading results
      const result = await api.post(
        "/api/test/submit",
        payload,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const isCorrect = result.data.isCorrect;
      setIsCorrectAnswer(isCorrect);
      setFeedback(result.data.feedback);
      // Guard against non-numeric values in API payloads.
      setPointsEarned(
        typeof result.data.pointsEarned === "number" ? result.data.pointsEarned : null
      );
      setPointsPossible(
        typeof result.data.pointsPossible === "number" ? result.data.pointsPossible : null
      );
      setNormalizedScore(
        typeof result.data.normalizedScore === "number" ? result.data.normalizedScore : null
      );
      if (isCorrect) setCorrectCount((prev) => prev + 1);
      setAnswered(true);
      setIsSubmitting(false);
    } 
    catch (error: unknown)
    {
      console.error("Failed to submit response:", error);
      
      // Log the full error details for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: { error?: string; message?: string }; statusText?: string } };
        console.error("Backend response:", {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
        });
        console.error("Full backend error data:", JSON.stringify(axiosError.response?.data, null, 2));
        
        const errorMsg = axiosError.response?.data?.error 
          || axiosError.response?.data?.message
          || axiosError.response?.statusText
          || "Network error occurred";
        setFeedback(`Submission failed (${axiosError.response?.status || 'unknown'}): ${errorMsg}`);
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setFeedback(`Submission failed: ${errorMessage}`);
      }
      setIsCorrectAnswer(false);
      setAnswered(true);
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setSelectedAnswers([]);
    setSelectedOrder([]);
    setDroppedAnswers({});
    setProgrammingAnswer("");
    setProgrammingLanguage("C");
    setAnswered(false);
    setFeedback("");
    setIsCorrectAnswer(false);
    setPointsEarned(null);
    setPointsPossible(null);
    setNormalizedScore(null);
    setPassedTests(null);
    setTotalTests(null);
    if (currentIndex + 1 < problems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const sharedFeedback = answered && feedback ? (() => {
    // Map score to status styling for text and box.
    const score = typeof normalizedScore === "number"
      ? normalizedScore
      : isCorrectAnswer
      ? 1
      : 0;
    const statusClass = isProfessorAccount
      ? "text-gray-700"
      : score >= 1
      ? "text-green-600"
      : score > 0.5
      ? "text-yellow-600"
      : "text-red-600";
    const boxClass = isProfessorAccount
      ? "bg-gray-100"
      : score >= 1
      ? "bg-green-50"
      : score > 0.5
      ? "bg-yellow-50"
      : "bg-red-50";
    const borderClass = isProfessorAccount
      ? "border-gray-300"
      : score >= 1
      ? "border-green-500"
      : score > 0.5
      ? "border-yellow-500"
      : "border-red-500";
    // Prefer explicit points, but fall back to question points when needed.
    const rawPointsPossible =
      typeof pointsPossible === "number" ? pointsPossible : current?.POINTS_POSSIBLE;
    // Coerce string values from the API into numbers when possible.
    const derivedPointsPossible =
      typeof rawPointsPossible === "number"
        ? rawPointsPossible
        : Number.isFinite(Number(rawPointsPossible))
        ? Number(rawPointsPossible)
        : null;
    // Derive points when only a normalized score is available.
    const derivedPointsEarned =
      typeof pointsEarned === "number"
        ? pointsEarned
        : typeof normalizedScore === "number" && typeof derivedPointsPossible === "number"
        ? Math.round(normalizedScore * derivedPointsPossible * 100) / 100
        : null;

    return (
      <div className="mt-6">
        <div className={`p-4 ${boxClass} rounded border ${borderClass} text-sm sm:text-base md:text-lg`}>
          <p className={statusClass}>{feedback}</p>
          {!isProfessorAccount && (derivedPointsEarned !== null || normalizedScore !== null) && (
            <div className="mt-2 text-gray-700">
              {typeof derivedPointsEarned === "number" && typeof derivedPointsPossible === "number" && (
                <p>Points: {derivedPointsEarned} / {derivedPointsPossible}</p>
              )}
              {typeof normalizedScore === "number" && (
                <p>Closeness: {Math.round(normalizedScore * 100)}%</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  })() : null;

  useEffect(() => {
    if (questionType === "ranked_choice" && current?.options) {
      setSelectedOrder(current.options);
    } else if (questionType === "drag_and_drop") {
      setDroppedAnswers({});
    }
  }, [currentIndex, questionType, current?.options]);

  if (!problems.length) {
    return (
      <Layout>
        <div className="text-center text-xl sm:text-2xl mt-20 font-semibold text-gray-700">
          Problem not found
        </div>
      </Layout>
    );
  }

  if (showResult) {
    const percentage = (correctCount / problems.length) * 100;
    return (
      <Layout>
        <div className="flex flex-col justify-center items-center min-h-screen px-4 sm:px-8 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6">
            Quiz Completed!
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl mb-4 sm:mb-6">
            You got {correctCount} out of {problems.length} questions correct!
          </p>
          {/* Message varies with score threshold */}
          <p className="text-lg sm:text-xl md:text-2xl mb-4 sm:mb-6 font-bold">
            {percentage < 50 ? "Keep practicing!" : "Great job!"}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate("/topic-practice")}
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 text-sm sm:text-base font-semibold rounded-full shadow"
            >
              Go to different topic
            </button>
            <button
              onClick={() => navigate("/mock-test")}
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-6 py-3 text-sm sm:text-base font-semibold rounded-full shadow"
            >
              Go to mock test
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const isCorrect = isCorrectAnswer;

  return (
    <Layout>
      <div className="pb-16">
        {/* Render the appropriate question component by type */}
        {questionType === "multiple_choice" ? (
        <MultipleChoice
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          selectedAnswer={selectedAnswer}
          setSelectedAnswer={setSelectedAnswer}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={answered}
          isCorrect={isCorrect}
          hideFeedback={true}
          feedbackContent={sharedFeedback}
        />
      ) : questionType === "ranked_choice" ? (
        <RankedChoice
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={answered}
          isCorrect={isCorrect}
          hideFeedback={true}
          feedbackContent={sharedFeedback}
        />
      ) : questionType === "drag_and_drop" ? (
        <DragAndDrop
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          droppedAnswers={droppedAnswers}
          setDroppedAnswers={setDroppedAnswers}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={answered}
          isCorrect={isCorrect}
          hideFeedback={true}
          feedbackContent={sharedFeedback}
        />
      ) : questionType === "programming" ? (
        <Programming
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          editorContent={programmingAnswer}
          setEditorContent={setProgrammingAnswer}
          selectedLanguage={programmingLanguage}
          setSelectedLanguage={setProgrammingLanguage}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          answered={answered}
          isSubmitting={isSubmitting}
          isCorrect={isCorrectAnswer}
          feedbackText={feedback}
          pointsEarned={pointsEarned}
          pointsPossible={pointsPossible}
          normalizedScore={normalizedScore}
          passedTests={passedTests}
          totalTests={totalTests}
          submissionsRemaining={progSubmitsRemaining}
        />
      ) : questionType === "select_all_that_apply" ? (
        <SelectAllThatApply
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          selectedAnswers={selectedAnswers}
          setSelectedAnswers={setSelectedAnswers}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={answered}
          isCorrect={isCorrect}
          hideFeedback={true}
          feedbackContent={sharedFeedback}
        />
      ) : (
        <FillInTheBlank
          current={current}
          currentIndex={currentIndex}
          total={problems.length}
          selectedAnswer={selectedAnswer}
          setSelectedAnswer={setSelectedAnswer}
          handleSubmit={handleSubmit}
          handleNext={handleNext}
          showFeedback={answered}
          isCorrect={isCorrect}
          hideFeedback={true}
          feedbackContent={sharedFeedback}
        />
      )}
      </div>
    </Layout>
  );
};

export default TopicTestPage;
