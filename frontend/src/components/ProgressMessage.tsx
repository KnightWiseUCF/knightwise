////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          ProgressMessage.tsx
//  Description:   Progress tab message component.
//
//  Dependencies:  react
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import React from "react";
import { ALL_TOPICS, formatSubcategoryLabel } from "../utils/topicLabels";

interface ProgressMessageProps {
  history: { datetime: string; topic: string }[];
  mastery: { [topic: string]: number };
  streakCount: number;
}

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

  const weakestTopic = (attemptedTopics.length > 0 && attemptedTopics[0][1] < 1.0)
    ? attemptedTopics[0][0]
    : null;

  // Find an unattempted topic
  const unattemptedTopics = ALL_TOPICS.filter((topic) => !(topic in mastery));
  const unattemptedTopic = unattemptedTopics.length > 0 ? unattemptedTopics[0] : null;

  return (
    <div className="mt-1 mb-10 mx-auto w-full max-w-3xl bg-amber-100 text-amber-900 border border-amber-300 p-4 rounded-lg shadow-md text-left">
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
          A little extra practice on <strong>{formatSubcategoryLabel(weakestTopic)}</strong> will help
          solidify your skills!&nbsp;
        </span>
      )}

      {unattemptedTopic && (
        <span>
          Want to branch out? Try <strong>{formatSubcategoryLabel(unattemptedTopic)}</strong> next!&nbsp;
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
