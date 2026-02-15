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

const TopicTestPage: React.FC = () => {
  const { topicName } = useParams<{ topicName: string }>();
  const [problems, setProblems] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [droppedAnswers, setDroppedAnswers] = useState<Record<string, string>>({});
  const [programmingAnswer, setProgrammingAnswer] = useState("");
  const [programmingLanguage, setProgrammingLanguage] = useState("C");
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean>(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [pointsPossible, setPointsPossible] = useState<number | null>(null);
  const [normalizedScore, setNormalizedScore] = useState<number | null>(null);
  const navigate = useNavigate();
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
            // drag_and_drop (new placement-based): store full answer objects with placement field
            answerObjects:  normalizedType === "drag_and_drop"
              ? question.answers || []
              : undefined,
            // drag_and_drop (old inline style): map each answer to a drop zone with id and correctAnswer
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

        setProblems(withOptions);
      } 
      catch (error: unknown)
      {
        console.error("Failed to load topic problems:", error);
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
    const current = problems[currentIndex];
    const questionType = current?.QUESTION_TYPE || "multiple_choice";

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

    if (!current || !hasAnswer) return;

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
        if (data.success) {
          // Show accepted vs incorrect based on judge response.
          const statusText = data.correct ? "Accepted" : "Incorrect";
          // Build optional output lines only when provided.
          const outputText = data.stdout ? `Output: ${data.stdout}` : "Output: (none)";
          const expectedText = data.expectedOutput ? `Expected: ${data.expectedOutput}` : "";
          setFeedback([statusText, outputText, expectedText].filter(Boolean).join(" | "));
          setIsCorrectAnswer(Boolean(data.correct));
        } else {
          const statusText = `Status: ${data.status || "Execution failed"}`;
          // Include compiler/runtime errors when present.
          const stderrText = data.stderr ? `Error: ${data.stderr}` : "";
          const compileText = data.compile_output ? `Compile: ${data.compile_output}` : "";
          setFeedback([statusText, compileText, stderrText].filter(Boolean).join(" | "));
          setIsCorrectAnswer(false);
        }
      } catch (error: unknown) {
        console.error("Failed to submit programming response:", error);
        
        // Log the full error details for debugging
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: any; statusText?: string } };
          console.error("Backend response:", {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
          });
          
          const errorMsg = axiosError.response?.data?.error 
            || axiosError.response?.data?.message
            || axiosError.response?.statusText
            || "Unknown error";
          setFeedback(`Failed to submit programming response (${axiosError.response?.status || 'unknown'}): ${errorMsg}`);
        } else {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          setFeedback(`Failed to submit programming response: ${errorMessage}`);
        }
        setIsCorrectAnswer(false);
      }

      setAnswered(true);
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
          return;
        }
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
    } 
    catch (error: unknown)
    {
      console.error("Failed to submit response:", error);
      
      // Log the full error details for debugging
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: any; statusText?: string } };
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
    if (currentIndex + 1 < problems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const current = problems[currentIndex];
  const questionType = current?.QUESTION_TYPE || 'multiple_choice';

  const sharedFeedback = answered && feedback ? (() => {
    // Map score to status styling for text and box.
    const score = typeof normalizedScore === "number"
      ? normalizedScore
      : isCorrectAnswer
      ? 1
      : 0;
    const statusClass = score >= 1
      ? "text-green-600"
      : score > 0.5
      ? "text-yellow-600"
      : "text-red-600";
    const boxClass = score >= 1
      ? "bg-green-50"
      : score > 0.5
      ? "bg-yellow-50"
      : "bg-red-50";
    const borderClass = score >= 1
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
          {(derivedPointsEarned !== null || normalizedScore !== null) && (
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
    if (questionType === "ranked_choice" && current) {
      setSelectedOrder(current.options);
    } else if (questionType === "drag_and_drop" && current) {
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
