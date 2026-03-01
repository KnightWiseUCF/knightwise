import React from 'react';
import { useLocation } from 'react-router-dom';

const ProblemViewPage: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const problem = {
    question: params.get('question') || 'Unknown',
    category: params.get('category') || 'Unknown',
    topic: params.get('topic') || 'Unknown',
    answerCorrect: params.get('answerCorrect') || 'Unknown',
    answersWrong: params.get('answersWrong') 
      ? (JSON.parse(params.get('answersWrong')!) as string[]) 
      : [],
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex flex-col items-center">
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-3xl w-full">
        {/* Header */}
        <h2 className="text-2xl font-bold text-center mb-4">Problem Details</h2>

        {/* Question */}
        <div className="mb-4 p-4 bg-gray-50 border-l-4 border-yellow-500 rounded-md">
          <p className="font-semibold">Question:</p>
          <div 
            className="question-rich-text mt-2 text-gray-700" 
            dangerouslySetInnerHTML={{ __html: problem.question }} 
          />
        </div>

        {/* Metadata (Category & Topic) */}
        <div className="flex justify-between text-gray-600 mb-4">
          <p><strong>Category:</strong> {problem.category}</p>
          <p><strong>Topic:</strong> {problem.topic}</p>
        </div>

        {/* Correct Answer */}
        <div className="mb-4 p-4 bg-green-100 border-l-4 border-green-500 rounded-md">
          <p className="font-semibold text-green-700">Correct Answer:</p>
          <p className="mt-1 text-green-900">{problem.answerCorrect}</p>
        </div>

        {/* Wrong Answers */}
        <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 rounded-md">
          <p className="font-semibold text-red-700">Wrong Answers:</p>
          <ul className="list-disc pl-5 mt-1 text-red-900">
            {problem.answersWrong.map((wrongAnswer, index) => (
              <li key={index}>{wrongAnswer}</li>
            ))}
          </ul>
        </div>

        {/* Close Button */}
        <div className="text-center mt-6">
          <button 
            className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-700 transition"
            onClick={() => window.close()}
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProblemViewPage;
