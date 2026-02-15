////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          RankedChoice.tsx
//  Description:   Ranked choice question component.
//
//  Dependencies:  react
//                 html-react-parser
//                 dompurify
//                 models (Question)
//
////////////////////////////////////////////////////////////////

import React, { useLayoutEffect, useRef, useState } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Question } from "../models";

type Props = {
  current: Question; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  selectedOrder: string[]; // current user order
  setSelectedOrder: (val: string[]) => void; // update order
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

const RankedChoice: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  selectedOrder,
  setSelectedOrder,
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const positions = useRef<Map<string, DOMRect>>(new Map());
  const prevOrderRef = useRef<string[]>(selectedOrder);
  const originalOrderRef = useRef<Map<string, number>>(new Map());

  // capture original positions when question first loads
  React.useEffect(() => {
    if (originalOrderRef.current.size !== selectedOrder.length) {
      originalOrderRef.current.clear();
      selectedOrder.forEach((ans, idx) => {
        originalOrderRef.current.set(ans, idx + 1);
      });
    }
  }, [selectedOrder, currentIndex]);

  const getDisplayIndex = (ans: string): number => {
    return originalOrderRef.current.get(ans) ?? 1;
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const next = [...selectedOrder];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSelectedOrder(next);
  };

  const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveItem(draggedIndex, index);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  useLayoutEffect(() => {
    const newPositions = new Map<string, DOMRect>();
    itemRefs.current.forEach((node, key) => {
      if (node) {
        newPositions.set(key, node.getBoundingClientRect());
      }
    });

    let hasAnimation = false;
    itemRefs.current.forEach((node, key) => {
      if (!node) return;
      const prevBox = positions.current.get(key);
      const newBox = newPositions.get(key);
      if (!prevBox || !newBox) return;

      const deltaY = prevBox.top - newBox.top;
      if (deltaY !== 0) {
        hasAnimation = true;
        node.style.transition = "transform 0s";
        node.style.transform = `translateY(${deltaY}px)`;
        node.getBoundingClientRect();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            node.style.transform = "";
            node.style.transition = "transform 180ms ease";
          });
        });
      }
    });

    if (hasAnimation) {
      setTimeout(() => {
        prevOrderRef.current = selectedOrder;
      }, 180);
    } else {
      prevOrderRef.current = selectedOrder;
    }

    positions.current = newPositions;
  }, [selectedOrder]);

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
        {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
      </div>

      {/* ranked choice instruction */}
      <p className="text-sm sm:text-base text-gray-600 mb-4 italic">
        Arrange the options in the correct order.
      </p>

      {/* ranked options */}
      <div className="space-y-3 mb-6">
        {selectedOrder.map((ans, idx) => (
          <div
            key={ans}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(ans, node);
              } else {
                itemRefs.current.delete(ans);
              }
            }}
            className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border text-sm sm:text-lg md:text-xl ${
              showFeedback
                ? "bg-gray-50 border-gray-200"
                : draggedIndex === idx
                ? "bg-yellow-50 border-yellow-400"
                : "bg-white border-gray-300"
            }`}
            draggable={!showFeedback}
            onDragStart={handleDragStart(idx)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(idx)}
            onDragEnd={handleDragEnd}
          >
            {/* style rows based on drag state and feedback lock */}
            <span className="flex-1 flex items-center gap-3">
              <span className="text-gray-400 select-none">⋮</span>
              <span className="mr-2 text-gray-500 transition-all duration-[180ms]">{getDisplayIndex(ans)}.</span>
              {ans}
            </span>
          </div>
        ))}
      </div>

      {feedbackContent}

      {/* button */}
      {/* if it's the last question, show the result button, otherwise show submit/next */}
      <div className="mt-6">
        {/* switch styling between disabled/submit/next states */}
        <button
          onClick={showFeedback ? handleNext : handleSubmit}
          disabled={!showFeedback && selectedOrder.length === 0}
          className={`px-5 sm:px-6 py-2 sm:py-3 rounded shadow font-semibold text-sm sm:text-base md:text-lg ${
            showFeedback
              ? "bg-yellow-400 hover:bg-yellow-500 text-black"
              : selectedOrder.length === 0
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
          ? "✓ Correct order!"
          : score > 0.5
          ? "△ Close order"
          : "✗ Incorrect order";

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

export default RankedChoice;
