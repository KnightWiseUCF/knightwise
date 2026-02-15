////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          SelectAllThatApply.tsx
//  Description:   Select all that apply question component.
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
  selectedAnswers: string[]; // selected answers by user
  setSelectedAnswers: (val: string[]) => void; // toggle answer selection
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

const SelectAllThatApply: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  selectedAnswers,
  setSelectedAnswers,
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
}) => {
  // toggle a single option without mutating state arrays
  const handleCheckboxChange = (answer: string) => {
    if (selectedAnswers.includes(answer)) {
      setSelectedAnswers(selectedAnswers.filter((a) => a !== answer));
    } else {
      setSelectedAnswers([...selectedAnswers, answer]);
    }
  };

  return (
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

      {/* select all that apply instruction */}
      <p className="text-sm sm:text-base text-gray-600 mb-4 italic">
        Select all that apply.
      </p>

      {/* checkbox options */}
      <div className="space-y-3 mb-6">
        {current.options.map((ans, idx) => (
          <label
            key={idx}
            className={`block p-3 sm:p-4 rounded-lg border transition cursor-pointer text-sm sm:text-lg md:text-xl ${
              selectedAnswers.includes(ans)
                ? "bg-yellow-100 border-yellow-500"
                : "bg-white border-gray-300 hover:bg-gray-50"
            } ${showFeedback ? "pointer-events-none" : ""}`}
          >
            {/* highlight selected options and lock interactions after submit */}
            <input
              type="checkbox"
              value={ans}
              checked={selectedAnswers.includes(ans)}
              onChange={() => handleCheckboxChange(ans)}
              // prevent changes after submit so feedback stays consistent
              disabled={showFeedback}
              className="mr-3"
            />
            {ans}
          </label>
        ))}
      </div>

      {feedbackContent}

      {/* button */}
      {/* if it's the last question, show the result button, otherwise show submit/next */}
      <div className="mt-6">
        {/* switch styling between disabled/submit/next states */}
        <button
          onClick={showFeedback ? handleNext : handleSubmit}
          disabled={!showFeedback && selectedAnswers.length === 0}
          className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
            showFeedback
              ? "bg-yellow-400 hover:bg-yellow-500 text-black"
              : selectedAnswers.length === 0
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
      {/* reveal correctness and the expected answers after submit */}
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
        const statusText = score >= 1
          ? "✓ Correct answer!"
          : score > 0.5
          ? "△ Close answer"
          : "✗ Incorrect answer";

        return (
          <div className="mt-6 p-4 bg-gray-100 rounded text-sm sm:text-base md:text-lg">
            <p className={`${statusClass} font-medium`}>{statusText}</p>
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
};

export default SelectAllThatApply;
