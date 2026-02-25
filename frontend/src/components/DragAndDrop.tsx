////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          DragAndDrop.tsx
//  Description:   Placement-based drag and drop question component.
//                 Answers are organized by PLACEMENT field into separate drop zones.
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
  droppedAnswers: Record<string, string>; // placement -> answer text (or similar mapping)
  setDroppedAnswers: (val: Record<string, string>) => void; // update dropped answers
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
  feedbackText,
  pointsEarned,
  pointsPossible,
  normalizedScore,
  hideFeedback,
  feedbackContent,
}) => {
  const [draggedAnswer, setDraggedAnswer] = useState<string | null>(null);
  const [availableAnswers, setAvailableAnswers] = useState<string[]>([]);



  // Group answers by their PLACEMENT field - create zones for UNIQUE placements only
  const answersByPlacement = React.useMemo(() => {
    const grouped: Record<string, string[]> = {};
    const answerObjects = current.answerObjects || [];

    if (answerObjects.length > 0) {
      // First, collect all unique PLACEMENT values
      const uniquePlacements = new Set<string>();
      answerObjects.forEach((answer) => {
        const rawPlacement = typeof answer.PLACEMENT === "string"
          ? answer.PLACEMENT
          : String(answer.PLACEMENT ?? "");
        const placement = rawPlacement.trim();
        if (placement) {
          uniquePlacements.add(placement);
        }
      });
      
      // Create a zone for each UNIQUE placement
      uniquePlacements.forEach((placement) => {
        grouped[placement] = [];
      });
      
      // If no valid placements found, fall back to creating generic drop zones
      if (uniquePlacements.size === 0) {
        answerObjects.forEach((_, idx) => {
          grouped[`Drop Zone ${idx + 1}`] = [];
        });
      }
    } else if (current.dropZones && current.dropZones.length > 0) {
      // Fallback to dropZones if answerObjects not available
      current.dropZones.forEach((_, idx) => {
        grouped[`Drop Zone ${idx + 1}`] = [];
      });
    } else if (current.options && current.options.length > 0) {
      // Last resort: create zones based on options
      current.options.forEach((_, idx) => {
        grouped[`Drop Zone ${idx + 1}`] = [];
      });
    }

    return grouped;
  }, [current.answerObjects, current.dropZones, current.options]);

  const placementKeys = Object.keys(answersByPlacement).sort();

  useEffect(() => {
    const dropped = Object.values(droppedAnswers);
    // Use current.options if available, otherwise extract from answerObjects
    const allAnswers = current.options && current.options.length > 0
      ? current.options
      : current.answerObjects?.map((a) => a.TEXT) || [];
    const available = allAnswers.filter((ans) => !dropped.includes(ans));
    setAvailableAnswers(available);
  }, [droppedAnswers, current.options, current.answerObjects]);

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

  // Handle drop in placement zone - place answer in zone
  const handleDropZoneDrop = (placement: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedAnswer) return;

    const newAnswers = { ...droppedAnswers };
    // Simple placement-based key: placement_0, placement_1, etc.
    const existingCount = Object.entries(newAnswers).filter(
      ([key]) => key.startsWith(placement)
    ).length;
    const zoneKey = `${placement}_${existingCount}`;
    newAnswers[zoneKey] = draggedAnswer;
    setDroppedAnswers(newAnswers);
    setDraggedAnswer(null);
  };

  // Check if all answers are placed
  const allPlaced = availableAnswers.length === 0;

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

      <div className="text-base sm:text-lg md:text-xl font-medium mb-6">
        {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
      </div>

      {/* placement-based drop zones */}
      <div className="mb-6 space-y-4">
        {placementKeys.map((placement) => (
          <div
            key={placement}
            className="border rounded-lg p-4 bg-gray-50"
          >
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Placement: {placement}
            </p>
            {/* drop zone for this placement */}
            <div
              className="min-h-[100px] p-4 bg-white border-2 border-dashed border-gray-300 rounded transition"
              onDragOver={handleDragOver}
              onDrop={handleDropZoneDrop(placement)}
            >
              {/* show answers in this placement zone */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(droppedAnswers)
                  .filter(([key]) => key.startsWith(placement))
                  .map(([key, answer]) => (
                    <div
                      key={key}
                      className="px-3 py-2 bg-yellow-100 border border-yellow-400 rounded"
                    >
                      {answer}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* answer pool */}
      <div className="mb-6">
        <p className="text-sm sm:text-base text-gray-600 mb-3 italic">
          drag answers to placement zones
        </p>
        <div
          className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg min-h-[100px]"
          onDragOver={handleDragOver}
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

      {feedbackContent}

      {/* button */}
      <div className="mt-6">
        {/* switch styling between disabled/submit/next states */}
        <button
          onClick={showFeedback ? handleNext : handleSubmit}
          disabled={!showFeedback && !allPlaced}
          className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
            showFeedback
              ? "bg-yellow-400 hover:bg-yellow-500 text-black"
              : !allPlaced
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
          ? "✓ Correct!"
          : score > 0.5
          ? "△ Close"
          : "✗ Incorrect";

        return (
          <div className={`mt-6 p-4 ${boxClass} rounded border ${borderClass} text-sm sm:text-base md:text-lg`}>
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

export default DragAndDrop;
