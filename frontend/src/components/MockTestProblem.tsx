////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          MockTestProblem.tsx
//  Description:   Individual Mock Test question
//
//  Dependencies:  react
//                 html-react-parser
//                 dompurify
//
////////////////////////////////////////////////////////////////

import React from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";

type Props = {
  current: any; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  selectedAnswer: string | null; // select answer by user
  setSelectedAnswer: (val: string) => void; // click radio button
  handleSubmit: () => void; // click submit
  handleNext: () => void; // click next
  showFeedback: boolean; // check if the last question or not
  isCorrect: boolean; // check correct answer
};

const MockTestProblem: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  selectedAnswer,
  setSelectedAnswer,
  handleSubmit,
  handleNext,
  showFeedback,
  isCorrect,
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
      {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
    </div>

    {/* multiple choice */}
    <div className="space-y-3">
      {current.options.map((ans: string, idx: number) => (
        <label
          key={idx}
          className={`block p-3 sm:p-4 rounded-lg border transition cursor-pointer text-sm sm:text-base md:text-xl ${
            selectedAnswer === ans
              ? "bg-yellow-100 border-yellow-500"
              : "bg-white border-gray-300 hover:bg-gray-50"
          }`}
        >
          <input
            type="radio"
            name="answer"
            value={ans}
            checked={selectedAnswer === ans}
            onChange={() => setSelectedAnswer(ans)}
            className="mr-3"
          />
          {ans}
        </label>
      ))}
    </div>

    {/* button */}
    {/* if it's the last question, show the result button, otherwise show submit/next */}
    <div className="mt-6">
      <button
        onClick={showFeedback ? handleNext : handleSubmit}
        className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
          showFeedback
            ? "bg-yellow-400 hover:bg-yellow-500 text-black"
            : "bg-yellow-600 hover:bg-yellow-700 text-white"
        }`}
      >
        {showFeedback
          ? currentIndex + 1 === total
            ? "Result"
            : "Next"
          : "Submit"}
      </button>
    </div>

    {/* feedback */}
    {showFeedback && (
      <div className="mt-6 p-4 bg-gray-100 text-center rounded text-sm sm:text-base md:text-lg font-medium">
        {isCorrect ? (
          <p className="text-green-600">Correct answer!</p>
        ) : (
          <p className="text-red-600">
            Incorrect answer. The correct answer is:{" "}
            <strong>{current.answerCorrect}</strong>
          </p>
        )}
      </div>
    )}
  </div>
);

export default MockTestProblem;
