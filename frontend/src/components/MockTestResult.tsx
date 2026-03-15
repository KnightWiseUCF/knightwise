import React from "react";
import { useNavigate } from "react-router-dom";
import { formatSubcategoryLabel } from "../utils/topicLabels";

interface MockTestResultProps {
  subcategoryScores: Record<string, { correct: number; total: number }>;
  subcategoryTotals: Record<string, number>;
  completionReason?: "completed" | "time_limit";
  onRetry: () => void;
}

const MockTestResult: React.FC<MockTestResultProps> = ({
  subcategoryScores,
  subcategoryTotals,
  completionReason = "completed",
  onRetry,
}) => {
  const navigate = useNavigate();
  const orderedSubcategories = Object.keys(subcategoryTotals).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  );

  // calculate total score
  let totalCorrect = 0;
  for (const subcategory in subcategoryScores) {
    totalCorrect += subcategoryScores[subcategory].correct;
  }

  const totalQuestions = Object.values(subcategoryTotals).reduce((sum, count) => sum + count, 0);

  // calcualate percentage
  const percentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  return (
    <div className="flex flex-col justify-center items-center min-h-screen px-4 sm:px-8 py-8 text-center">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6">
        {completionReason === "time_limit" ? "Time's up!" : "Test Completed!"}
      </h1>

      <p className="text-lg sm:text-xl md:text-2xl mb-4 sm:mb-6">
        Here is your performance by subcategory:
      </p>

      {/* display section score */}
      <div className="text-base sm:text-lg md:text-xl mb-4 sm:mb-6 space-y-2">
        {orderedSubcategories.map((subcategory) => {
          const score = subcategoryScores[subcategory] || { correct: 0, total: 0 };
          const totalForSubcategory = subcategoryTotals[subcategory] || 0;
          return (
            <p key={subcategory}>
              {formatSubcategoryLabel(subcategory)} : <strong>{score.correct}</strong> / {totalForSubcategory} correct
            </p>
          );
        })}
      </div>

      {/* total */}
      <p className="text-base sm:text-lg md:text-xl font-medium mb-4 sm:mb-6">
        Your score is {percentage.toFixed(1)}% –{" "}
        {percentage < 50 ? "below 50%. Keep practicing!" : "great job!"}
      </p>

      {/* next option */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <button
          onClick={() => navigate("/topic-practice")}
          className="bg-yellow-400 hover:bg-yellow-500 text-black px-5 sm:px-6 py-2 sm:py-3 text-sm sm:text-base md:text-lg font-semibold rounded-xl shadow"
        >
          Go to Topic Practice
        </button>
        <button
          onClick={onRetry}
          className="bg-yellow-400 hover:bg-yellow-500 text-black px-5 sm:px-6 py-2 sm:py-3 text-sm sm:text-base md:text-lg font-semibold rounded-xl shadow"
        >
          Back to Setup
        </button>
      </div>
    </div>
  );
};

export default MockTestResult;
