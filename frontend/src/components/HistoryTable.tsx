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
//                 models (RawQuestion, HistoryEntry, HistoryResponse)
//                 
//
////////////////////////////////////////////////////////////////

import React, { useCallback, useEffect, useState } from 'react';
import api from "../api";
import correctAnswerImg from "../assets/correctAnswer.png";
import incorrectAnswerImg from "../assets/incorrectAnswer.png";
import viewProblemImg from "../assets/viewProblem.png";
import { RawQuestion, HistoryEntry, HistoryResponse } from '../models';

const HistoryTable: React.FC = () => {
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [totalPages, setTotalPages]   = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading]     = useState<boolean>(true);

  const fetchHistory = useCallback(async (page: number) => {
    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      const response = await api.get<HistoryResponse>("api/progress/history", 
      {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { page, limit: 10 },
      });

      setHistory(response.data.history);
      setTotalPages(response.data.totalPages);
      setCurrentPage(response.data.currentPage);
    } 
    catch 
    {
      console.error('Error fetching history');
    }
    finally
    {
      setIsLoading(false);
    }
  }, []);

  // Helper function, gets full question from backend, combines it with
  // user response data and sends it to the popup through
  // localStorage (to handle long text)
  const fetchProblem = async (entry: HistoryEntry) => {

    // Set popup size
    const width   = 700;
    const height  = 600;
    const left    = (window.innerWidth - width) / 2;
    const top     = (window.innerHeight - height) / 2;

    // Write to localStorage so popup can read it
    // Unique storage key
    const storageKey = `kwProblemView_${entry.problem_id}_${Date.now()}`;

    // Open popup
    const popupWindow = window.open(
      `/problem-view?key=${storageKey}`, 
      'kwProblemViewPopup', 
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
    if (popupWindow) 
    {
      popupWindow.focus();
    }

    const token = localStorage.getItem('token');

    try 
    {
      const response = await api.get<RawQuestion>(`api/problems/${entry.problem_id}`, 
      {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const problem = response.data;

      // Combine question data and user response data
      const popupPayload = {
        // Question data
        questionText: problem.QUESTION_TEXT,
        category:     problem.CATEGORY,
        topic:        problem.SUBCATEGORY,
        type:         problem.TYPE,
        answers:      problem.answers ?? [],

        // User response data
        userAnswer:     entry.userAnswer, // JSON
        pointsEarned:   entry.pointsEarned,
        pointsPossible: entry.pointsPossible,
        isCorrect:      entry.isCorrect,
        datetime:       entry.datetime,
      };

      // Write to localStorage
      localStorage.setItem(storageKey, JSON.stringify(popupPayload));
    } 
    catch
    {
      console.error('Error fetching problem');
    }
  };

  useEffect(() => {
    fetchHistory(currentPage);
  }, [currentPage, fetchHistory]);

  return (
    <div className="m-1">
      <h2 className="text-2xl font-semibold text-center mb-4">Problem History</h2>

      {/* Check for loading state */}
      {isLoading ? (
        <p className="text-center text-gray-500">Loading history...</p>
      ) : history.length === 0 ? (
        <p className="text-center">No history yet—but every expert starts somewhere!</p>
      ) : (
        <div className="overflow-hidden rounded-lg shadow-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-[#333333] text-white">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">View Problem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-[#EEEEEE]' : 'bg-[#BBBBBB]'}>
                  <td className="px-4 py-2 text-center whitespace-nowrap">{new Date(entry.datetime).toLocaleString(undefined, {
                    year:   'numeric',
                    month:  'numeric',
                    day:    'numeric',
                    hour:   'numeric',
                    minute: '2-digit',
                  })}
                  </td>
                  <td className="px-4 py-2 text-center">{entry.topic}</td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">{entry.type ?? '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <img
                      src={entry.isCorrect ? correctAnswerImg : incorrectAnswerImg}
                      alt={entry.isCorrect ? '✅' : '❌'}
                      className="w-6 h-6 inline-block"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="focus:outline-none hover:opacity-80 hover:scale-110"
                      onClick={() => fetchProblem(entry)}
                    >
                      <img
                        src={viewProblemImg}
                        alt="View problem"
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
          disabled={isLoading || currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-blue-yellow disabled:bg-gray-300 disabled:text-gray-700 disabled:border-gray-400 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {/* Check for loading state */}
        <span className="text-lg">
          {isLoading ? 'Loading...' : `Page ${currentPage} of ${totalPages}`}
        </span>
        <button
          disabled={isLoading || currentPage === totalPages}
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
