////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          ProgressMessage.tsx
//  Description:   Progress tab message component.
//
//  Dependencies:  react
//
////////////////////////////////////////////////////////////////

import React from "react";

interface ProgressMessageProps {
  history: { datetime: string; topic: string }[];
  mastery: { [topic: string]: number };
  streakCount: number;
}

const allTopics = [
  "Algorithm Analysis", "AVL Trees", "Backtracking", "Base Conversion", "Binary Trees",
  "Bitwise Operators", "Dynamic Memory", "Hash Tables", "Heaps", "Linked Lists",
  "Queues", "Recurrence Relations", "Recursion", "Sorting", "Stacks", "Summations", "Tries"
];

const ProgressMessage: React.FC<ProgressMessageProps> = ({ history, mastery, streakCount }) => {
  const today = new Date().toDateString();

  // Count how many problems were solved today
  const todayProblemCount = history.filter(
    (entry) => new Date(entry.datetime).toDateString() === today
  ).length;

  // Find weakest topic (lowest mastery percentage among attempted topics)
  const attemptedTopics = Object.entries(mastery)
    .filter(([, level]) => typeof level === "number")
    .sort((a, b) => (a[1] as number) - (b[1] as number));

  const weakestTopic = (attemptedTopics.length > 0 && attemptedTopics[0][1] < 100)
    ? attemptedTopics[0][0]
    : null;

  // Find an unattempted topic
  const unattemptedTopics = allTopics.filter((topic) => !(topic in mastery));
  const unattemptedTopic = unattemptedTopics.length > 0 ? unattemptedTopics[0] : null;

  return (
    <div className="mt-1 mb-5 mx-auto w-full max-w-3xl bg-[#ffc904] text-gray-800 p-4 rounded-lg shadow-md text-left">
      {todayProblemCount > 0 ? (
        <span>
          Great work! You solved <strong>{todayProblemCount}</strong> problem
          {todayProblemCount > 1 ? "s" : ""} today! 🎉&nbsp;
        </span>
      ) : (
        <span>Ready to start practicing? Solve your first problem today!&nbsp;</span>
      )}

      {weakestTopic && (
        <span>
          A little extra practice on <strong>{weakestTopic}</strong> will help
          solidify your skills!&nbsp;
        </span>
      )}

      {unattemptedTopic && (
        <span>
          Want to branch out? Try <strong>{unattemptedTopic}</strong> next!&nbsp;
        </span>
      )}

      {streakCount > 0 ? (
        <span>
          You're on a <strong>{streakCount}-day</strong> streak! 🔥 Keep it up!&nbsp;
        </span>
      ) : (
        <span>Let's start building that streak!&nbsp;</span>
      )}
    </div>
  );
};

export default ProgressMessage;
