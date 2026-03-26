////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     KnightWise Team
//  File:          MockTestInfo.tsx
//  Description:   "Build an Exam" setup page component
//
//  Dependencies:  react
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import React from "react";
import { formatSubcategoryLabel } from "../utils/topicLabels";

interface MockTestInfoProps {
  availableTopics: string[];
  selectedTopics: string[];
  questionCount: number;
  timeLimitMinutes: number;
  isStarting: boolean;
  errorMessage: string;
  onToggleTopic: (topic: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onQuestionCountChange: (count: number) => void;
  onTimeLimitChange: (minutes: number) => void;
  onStart: () => void;
}

const MockTestInfo: React.FC<MockTestInfoProps> = ({
  availableTopics,
  selectedTopics,
  questionCount,
  timeLimitMinutes,
  isStarting,
  errorMessage,
  onToggleTopic,
  onSelectAll,
  onClearAll,
  onQuestionCountChange,
  onTimeLimitChange,
  onStart,
}) => {
  return (
    <div className="flex justify-center items-center min-h-screen px-4 py-10 sm:px-6 md:px-10">
      <div className="w-full max-w-7xl rounded-3xl border border-yellow-200 bg-gradient-to-br from-amber-50 via-white to-yellow-100 p-6 shadow-xl sm:p-10">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl">
            Build an Exam
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-gray-700 sm:text-lg">
            Choose the topics you want to practice, how many questions to answer,
            and a time limit.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
          <section className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Topics</h3>
                <p className="text-sm text-gray-600">
                  {selectedTopics.length} selected
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-yellow-500 hover:text-gray-900"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-yellow-500 hover:text-gray-900"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {availableTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic);

                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => onToggleTopic(topic)}
                    className={[
                      "rounded-2xl border px-4 py-4 text-left transition",
                      isSelected
                        ? "border-yellow-500 bg-yellow-100 text-gray-900 shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-yellow-300 hover:bg-yellow-50",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold sm:text-base">{formatSubcategoryLabel(topic)}</span>
                      <span
                        className={[
                          "inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold",
                          isSelected
                            ? "border-yellow-600 bg-yellow-500 text-black"
                            : "border-gray-300 text-transparent",
                        ].join(" ")}
                      >
                        ✓
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-white p-5 text-gray-900 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold text-gray-900">Exam settings</h3>
            <div className="mt-6 space-y-6">
              <div>
                <label htmlFor="mock-test-question-count" className="block text-sm font-medium text-gray-700">
                  Question count
                </label>
                <div className="mt-3 flex items-end gap-3">
                  <input
                    id="mock-test-question-count"
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={questionCount}
                    onChange={(event) => onQuestionCountChange(Number(event.target.value))}
                    className="w-28 rounded-xl border border-amber-300 bg-white px-4 py-3 text-lg font-semibold text-gray-900 outline-none transition focus:border-amber-500"
                  />
                  <span className="pb-3 text-sm uppercase tracking-[0.2em] text-gray-600">
                    questions
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Choose between 1 and 50 questions.
                </p>
              </div>

              <div>
                <label htmlFor="mock-test-time-limit" className="block text-sm font-medium text-gray-700">
                  Time limit
                </label>
                <div className="mt-3 flex items-end gap-3">
                  <input
                    id="mock-test-time-limit"
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    value={timeLimitMinutes}
                    onChange={(event) => onTimeLimitChange(Number(event.target.value))}
                    className="w-28 rounded-xl border border-amber-300 bg-white px-4 py-3 text-lg font-semibold text-gray-900 outline-none transition focus:border-amber-500"
                  />
                  <span className="pb-3 text-sm uppercase tracking-[0.2em] text-gray-600">
                    minutes
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  Choose between 5 and 180 minutes.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-white p-4 text-sm text-gray-700">
                <p>
                  Selected topics: <strong className="text-gray-900">{selectedTopics.length}</strong>
                </p>
                <p className="mt-2">
                  Question count: <strong className="text-gray-900">{questionCount}</strong>
                </p>
                <p className="mt-2">
                  Estimated duration: <strong className="text-gray-900">{timeLimitMinutes} minutes</strong>
                </p>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="button"
                onClick={onStart}
                disabled={isStarting || selectedTopics.length === 0}
                className="w-full rounded-2xl bg-yellow-400 px-6 py-4 text-base font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-yellow-200"
              >
                {isStarting ? "Preparing test..." : "Start custom mock test"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MockTestInfo;
