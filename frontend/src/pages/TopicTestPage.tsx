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
  const navigate = useNavigate();

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

        setProblems(withOptions);
      } 
      catch 
      {
        console.error("Failed to load topic problems");
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
        return Object.entries(droppedAnswers).reduce((acc, [zoneId, answer]) => {
          if (answer) {
            acc[answer] = zoneId;
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

    const hasAnswer = questionType === "multiple_choice" || questionType === "fill_in_blank"
      ? selectedAnswer?.trim()
      : questionType === "ranked_choice"
        ? selectedOrder.length === (current?.options.length || 0)
        : questionType === "drag_and_drop"
          ? (current?.dropZones || []).length > 0 &&
            Object.keys(droppedAnswers).length === (current?.dropZones || []).length
          : questionType === "programming"
            ? programmingAnswer.trim().length > 0
            : selectedAnswers.length > 0;

    if (!current || !hasAnswer) return;

    if (questionType === "programming") {
      setFeedback("Submission saved.");
      setIsCorrectAnswer(false);
      setAnswered(true);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const userAnswer = buildUserAnswer(questionType);

      // Get grading results
      const result = await api.post(
        "/api/test/submit",
        {
          problem_id: current.ID,
          userAnswer,
          category: current.CATEGORY,
          topic: current.SUBCATEGORY,
        },
        token ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        } : undefined
      );

      const isCorrect = result.data.isCorrect;
      setIsCorrectAnswer(isCorrect);
      setFeedback(result.data.feedback);
      if (isCorrect) setCorrectCount((prev) => prev + 1);
      setAnswered(true);
    } 
    catch
    {
      console.error("Failed to submit response");
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
    if (currentIndex + 1 < problems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const current = problems[currentIndex];
  const questionType = current?.QUESTION_TYPE || 'multiple_choice';

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
        />
      )}
      {answered && feedback && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
          <div className="p-4 bg-gray-100 rounded text-sm sm:text-base md:text-lg">
            <p className={isCorrect ? "text-green-600" : "text-red-600"}>
              {feedback}
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TopicTestPage;
