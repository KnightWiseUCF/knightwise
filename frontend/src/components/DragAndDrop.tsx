////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          DragAndDrop.tsx
//  Description:   Drag and drop question component.
//
//  Dependencies:  react
//                 html-react-parser
//                 dompurify
//                 models (Question)
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Question } from "../models";

type Props = {
  current: Question; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  droppedAnswers: Record<string, string>; // zone id -> answer text
  setDroppedAnswers: (val: Record<string, string>) => void; // update dropped answers
  handleSubmit: () => void; // click submit
  handleNext: () => void; // click next
  showFeedback: boolean; // check if the last question or not
  isCorrect: boolean; // check correct answer
};

const DragAndDrop: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  droppedAnswers,
  setDroppedAnswers,
  handleSubmit,
  handleNext,
  showFeedback,
  isCorrect,
}) => {
  const [draggedAnswer, setDraggedAnswer] = useState<string | null>(null);
  const [availableAnswers, setAvailableAnswers] = useState<string[]>([]);

  // Split question text by blanks and interleave with drop zones
  // Render question text with inline drop zones replacing [blank] placeholders
  const renderInlineQuestion = () => {
    const parts = current.QUESTION_TEXT.split(/(\[blank\])/i);
    let zoneIndex = 0;

    return (
      <div className="text-base sm:text-lg md:text-xl font-medium mb-6 leading-relaxed">
        {parts.map((part, idx) => {
          // Replace [blank] markers with draggable drop zones
          if (part.toLowerCase() === "[blank]") {
            const zone = current.dropZones?.[zoneIndex];
            if (!zone) return null;
            
            const currentZoneId = zone.id;
            zoneIndex++;
            
            return (
              <div
                key={zone.id}
                className={`inline-block px-3 sm:px-4 py-0.5 sm:py-1 mx-1 min-w-[90px] sm:min-w-[110px] text-center border-2 border-dashed rounded transition ${
                  // Visual feedback: green if correct, red if wrong after submission
                  showFeedback
                    ? droppedAnswers[currentZoneId] === zone.correctAnswer
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                    : droppedAnswers[currentZoneId]
                    ? "border-yellow-500 bg-yellow-50"
                    : "border-gray-400 bg-white"
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDropZoneDrop(currentZoneId)}
              >
                {droppedAnswers[currentZoneId] ? (
                  <span className="text-sm sm:text-base font-semibold">{droppedAnswers[currentZoneId]}</span>
                ) : (
                  <span className="text-xs sm:text-sm text-gray-400 italic">...</span>
                )}
              </div>
            );
          }
          // Return non-blank text parts with HTML sanitization
          return <span key={idx}>{parse(DOMPurify.sanitize(part))}</span>;
        })}
      </div>
    );
  };

  useEffect(() => {
    const dropped = Object.values(droppedAnswers);
    const available = current.options.filter((ans) => !dropped.includes(ans));
    setAvailableAnswers(available);
  }, [droppedAnswers, current.options]);

  // Handle drag start - store the dragged answer
  const handleDragStart = (answer: string) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggedAnswer(answer);
    event.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over - allow drop
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  // Handle drop in zone - place answer in zone, remove from previous zone if applicable
  const handleDropZoneDrop = (zoneId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedAnswer) return;

    const newAnswers = { ...droppedAnswers };
    // If zone already has an answer, return it to the pool
    if (newAnswers[zoneId]) {
      setAvailableAnswers([...availableAnswers, newAnswers[zoneId]]);
    }
    newAnswers[zoneId] = draggedAnswer;
    setDroppedAnswers(newAnswers);
    setDraggedAnswer(null);
  };

  // Handle drop back to answer pool - remove from zone
  const handleAnswerPoolDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedAnswer) return;

    const newAnswers = { ...droppedAnswers };
    // Find which zone has this answer and remove it
    for (const [zoneId, answer] of Object.entries(newAnswers)) {
      if (answer === draggedAnswer) {
        delete newAnswers[zoneId];
        setDroppedAnswers(newAnswers);
        break;
      }
    }
    setDraggedAnswer(null);
  };

  // Check if all zones are filled
  const allFilled = (current.dropZones || []).length === Object.keys(droppedAnswers).length;

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

      {renderInlineQuestion()}

      {/* drop zones section removed - zones now embedded in question */}

      {/* answer pool */}
      <div className="mb-6">
        <p className="text-sm sm:text-base text-gray-600 mb-3 italic">
          drag answers to drop zones
        </p>
        <div
          className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg min-h-[100px]"
          onDragOver={handleDragOver}
          onDrop={handleAnswerPoolDrop}
        >
          {availableAnswers.map((ans, idx) => (
            <div
              key={`${ans}-${idx}`}
              draggable={!showFeedback}
              onDragStart={handleDragStart(ans)}
              className={`px-5 sm:px-6 py-2 sm:py-3 rounded-full font-semibold text-sm sm:text-base md:text-lg transition ${
                showFeedback
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-yellow-400 hover:bg-yellow-500 text-black cursor-move"
              }`}
            >
              {ans}
            </div>
          ))}
        </div>
      </div>

      {/* button */}
      <div className="mt-6">
        <button
          onClick={showFeedback ? handleNext : handleSubmit}
          disabled={!showFeedback && !allFilled}
          className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
            showFeedback
              ? "bg-yellow-400 hover:bg-yellow-500 text-black"
              : !allFilled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
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
        <div className="mt-6 p-4 bg-gray-100 rounded text-sm sm:text-base md:text-lg">
          {isCorrect ? (
            <p className="text-green-600 font-medium">✓ Correct!</p>
          ) : (
            <div className="text-red-600">
              <p className="font-medium mb-2">✗ Incorrect</p>
              <p className="text-sm">
                Check the highlighted zones for corrections.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DragAndDrop;
