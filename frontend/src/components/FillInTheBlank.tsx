////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          FillInTheBlank.tsx
//  Description:   Individual fill-in-the-blank question.
//
//  Dependencies:  react
//                 html-react-parser
//                 dompurify
//                 models (Question)
//
////////////////////////////////////////////////////////////////

import React from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Question } from "../models";

type Props = {
  current: Question; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  selectedAnswer: string | null; // select answer by user
  setSelectedAnswer: (val: string) => void; // click radio button
  handleSubmit: () => void; // click submit
  handleNext: () => void; // click next
  showFeedback: boolean; // check if the last question or not
  isCorrect: boolean; // check correct answer
  feedbackText?: string; // optional grader feedback
  pointsEarned?: number | null; // points earned
  pointsPossible?: number | null; // points possible
  normalizedScore?: number | null; // normalized score (0-1)
  hideFeedback?: boolean; // suppress feedback box
  feedbackContent?: React.ReactNode; // custom feedback content
};

const FillInTheBlank: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  selectedAnswer,
  setSelectedAnswer,
  handleSubmit,
  handleNext,
  showFeedback,
  isCorrect,
  feedbackText,
  pointsEarned,
  pointsPossible,
  normalizedScore,
  hideFeedback,
  feedbackContent,
}) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 mt-12 sm:mt-16 md:mt-20">
    {/* top: section, category, subcategory, exam date */}
    <div className="flex flex-col sm:flex-row justify-between mb-2 text-sm sm:text-lg md:text-2xl">
      <p className="text-gray-600">Section {current.SECTION}</p>
      <p className="font-medium">
        Question {currentIndex + 1} of {total}
      </p>
    </div>

    <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-2">
      {current.CATEGORY} <span className="text-yellow-600">&gt;</span>{" "}
      {current.SUBCATEGORY}
      <span className="block text-sm sm:text-base md:text-xl text-gray-500 font-normal mt-1 sm:mt-0">
        (Exam Date: {current.AUTHOR_EXAM_ID})
      </span>
    </h1>

    {/* question */}
    <h2 className="text-lg font-semibold mb-2">
      Question {currentIndex + 1} of {total}
    </h2>

    <div className="text-base sm:text-lg md:text-xl font-medium mb-4">
      {/* sanitize html coming from the api before rendering */}
      {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
    </div>

    {/* fill-in-the-blank input */}
    <div className="mb-6">
      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
        Your Answer:
      </label>
      {/* swap styling based on feedback state and correctness */}
      <input
        type="text"
        value={selectedAnswer || ""}
        onChange={(e) => setSelectedAnswer(e.target.value)}
        // lock input after submit so feedback matches the submitted answer
        disabled={showFeedback}
        placeholder="Type your answer here..."
        className={`w-full p-3 sm:p-4 rounded-lg border text-sm sm:text-base md:text-xl transition ${
          showFeedback
            ? isCorrect
              ? "bg-green-50 border-green-500"
              : "bg-red-50 border-red-500"
            : "bg-white border-gray-300 hover:border-yellow-500 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
        }`}
      />
    </div>

    {feedbackContent}

    {/* button */}
    {/* if it's the last question, show the result button, otherwise show submit/next */}
    <div className="mt-6">
      {/* switch styling between disabled/submit/next states */}
      <button
        onClick={showFeedback ? handleNext : handleSubmit}
        disabled={!showFeedback && !selectedAnswer?.trim()}
        className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
          showFeedback
            ? "bg-yellow-400 hover:bg-yellow-500 text-black"
            : !selectedAnswer?.trim()
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-yellow-600 hover:bg-yellow-700 text-white"
        }`}
      >
        {/* label toggles between submit and next/result */}
        {showFeedback
          ? currentIndex + 1 === total
            ? "Result"
            : "Next"
          : "Submit"}
      </button>
    </div>

    {/* feedback */}
    {/* reveal correctness and the expected answer after submit */}
    {showFeedback && !hideFeedback && (() => {
      // map score into status text and color.
      const score = typeof normalizedScore === "number"
        ? normalizedScore
        : isCorrect
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
      const statusText = score >= 1
        ? "✓ Correct answer!"
        : score > 0.5
        ? "△ Close answer"
        : "✗ Incorrect answer";

      return (
        <div className={`mt-6 p-4 ${boxClass} rounded border ${borderClass} text-sm sm:text-base md:text-lg`}>
          <p className={`${statusClass} font-medium`}>{statusText}</p>
          {/* only show the details when we have feedback text, points, or a score */}
          {(feedbackText || pointsEarned !== null || normalizedScore !== null) && (
            <div className="mt-3 text-gray-700">
              {feedbackText && <p>{feedbackText}</p>}
              {typeof pointsEarned === "number" && typeof pointsPossible === "number" && (
                <p>Points: {pointsEarned} / {pointsPossible}</p>
              )}
              {typeof normalizedScore === "number" && (
                <p>Closeness: {Math.round(normalizedScore * 100)}%</p>
              )}
            </div>
          )}
        </div>
      );
    })()}
  </div>
);

export default FillInTheBlank;