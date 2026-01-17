////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          HistoryTable.tsx
//  Description:   My Progress tab's Problem History table
//
//  Dependencies:  react
//                 api instance
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from 'react';
import api from "../api";
import correctAnswer from "../assets/correctAnswer.png";
import incorrectAnswer from "../assets/incorrectAnswer.png";
import viewProblem from "../assets/viewProblem.png";

const HistoryTable: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const token = localStorage.getItem('token');

  const fetchHistory = async (page: number) => {
    try {
      const response = await api.get("api/progress/history", 
      {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { page, limit: 10 },
      });

      setHistory(response.data.history);
      setTotalPages(response.data.totalPages);
      setCurrentPage(response.data.currentPage);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchProblem = async (problemId: string) => {
    try {
      const response = await api.get(`api/problems/${problemId}`, 
      {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const problem = response.data;

      // Get correct and incorrect answers
      const correctAnswer = problem.answers?.find((a: any) => a.IS_CORRECT_ANSWER)?.TEXT || '';
      const wrongAnswers = problem.answers
        ?.filter((a: any) => !a.IS_CORRECT_ANSWER)
        .map((a: any) => a.TEXT) || [];

      const problemParams = new URLSearchParams({
        question: problem.QUESTION_TEXT,
        category: problem.CATEGORY,
        topic: problem.SUBCATEGORY,
        answerCorrect: correctAnswer,
        answersWrong: JSON.stringify(wrongAnswers),
      }).toString();

      const width = 600;
      const height = 400;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popupWindow = window.open(
        `/problem-view?${problemParams}`, 
        '_blank', 
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
      );

      if (popupWindow) {
        popupWindow.focus();
      }
    } catch (error) {
      console.error('Error fetching problem:', error);
    }
  };

  useEffect(() => {
    fetchHistory(currentPage);
  }, [currentPage]);

  return (
    <div className="m-1">
      <h2 className="text-2xl font-semibold text-center mb-4">Problem History</h2>
      {history.length === 0 ? (
        <p className="text-center">No history yet—but every expert starts somewhere!</p>
      ) : (
        <div className="overflow-hidden rounded-lg shadow-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-[#333333] text-white">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">View Problem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-[#EEEEEE]' : 'bg-[#BBBBBB]'}>
                  <td className="px-4 py-2 text-center">{new Date(entry.datetime).toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">{entry.topic}</td>
                  <td className="px-4 py-2 text-center">
                    <img
                      src={entry.isCorrect ? correctAnswer : incorrectAnswer}
                      alt={entry.isCorrect ? '✅' : '❌'}
                      className="w-6 h-6 inline-block"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="focus:outline-none hover:opacity-80 hover:scale-110"
                      onClick={() => fetchProblem(entry.problem_id)}
                    >
                      <img
                        src={viewProblem}
                        alt="➡️"
                        className="w-6 h-6 inline-block"
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
  
      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-4 space-x-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-blue-yellow disabled:bg-gray-300 disabled:text-gray-700 disabled:border-gray-400 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-lg">{`Page ${currentPage} of ${totalPages}`}</span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-700 disabled:bg-gray-300 disabled:text-gray-700 disabled:border-gray-400 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}  

export default HistoryTable;