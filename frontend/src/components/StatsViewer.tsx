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
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import React, { useCallback, useEffect, useState } from 'react';
import api from "../api";
import { RawQuestion, HistoryEntry, HistoryResponse, ProgressData} from '../models';
import { ALL_TOPICS} from "../utils/topicLabels"
import { formatSubcategoryLabel } from '../utils/topicLabels';
import { X, Check, SquareArrowOutUpRightIcon } from "lucide-react";
import { ALL } from 'dns';

/*
export interface HistoryEntry
{
  datetime:       string;
  topic:          string;
  type:           string; // Question.TYPE (Multiple Choice, Programming, etc.)
  isCorrect:      boolean;
  problem_id:     number;
  userAnswer:     string | null; // JSON with answer data
  pointsEarned:   number | null;
  pointsPossible: number | null;
}

export interface HistoryResponse
{
  history:      HistoryEntry[];
  totalPages:   number;
  currentPage:  number;
}

export interface RawQuestion
{
  ID:             number;
  TYPE:           string;
  SECTION:        string;
  CATEGORY:       string;   //question type: mult choice etc
  SUBCATEGORY:    string;   //question topic
  AUTHOR_EXAM_ID: string;
  POINTS_POSSIBLE: number;
  QUESTION_TEXT:  string;
  OWNER_ID:       number;
  answers?:       Answer[];
}

export const ALL_TOPICS = [
  "InputOutput", // Canonical name, display name is Input/Output
  "Branching",
  "Loops",
  "Variables",
  "Arrays",
  "Linked Lists",
  "Strings",
  "Classes",
  "Methods",
  "Trees",
  "Stacks",
  "Heaps",
  "Tries",
  "Bitwise Operators",
  "Dynamic Memory",
  "Algorithm Analysis",
  "Recursion",
  "Sorting",
] as const;

*/

const ALL_STATS = [
    "Performance",
    "Accuracy", //median
    "Average Score", //median
    "Average Elapsed Time", //median
    "Completed Questions",
]

interface AggregateData
{
    Performance:    number;
    Accuracy:       number;
    AvgScore:       number;
    AvgElapsedTime: number;
    NumQuestions:   number;
}

const StatsViewer: React.FC = () => {

  const   [history, setHistory]         = useState<HistoryEntry[]>([]);
  var allHistory: HistoryEntry[] = [];
  const [progressData, setProgressData] = useState<ProgressData>({});
  const [statViewerData, setStatViewerData] = useState<AggregateData>({
    Performance: 0, 
    Accuracy: 0, 
    AvgScore: 0, 
    AvgElapsedTime:0, 
    NumQuestions: 0});
  const [topicChoice, setTopicChoice] = useState<string>("All");
  const [totalPages, setTotalPages]   = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading]     = useState<boolean>(true);

  const nullOrNumToNum = (nullOrNum: number | null) => {

    return nullOrNum == null ? 0 : nullOrNum;
  }

  const aggregateStats = (topic: string) => {

    let numCorrect = 0;
    let numCompletedQuestions = 0;

    let pointsEarned = 0;
    let numPointsPossible = 0;

    let totalElapsedTime = 0;
    let performance = 0;
    

    for (let i = 0; i < history.length; i++)
    {
        if(topic.toLowerCase() !== "All".toLowerCase() || history[i].topic.toLowerCase() !== topic.toLowerCase())
            continue;


        if (history[i].isCorrect) numCorrect++;
        numCompletedQuestions++;
        pointsEarned += nullOrNumToNum(history[i].pointsEarned);
        numPointsPossible += nullOrNumToNum(history[i].pointsPossible);
        totalElapsedTime += nullOrNumToNum(history[i].elapsedTime);

    }

    if (topic.toLowerCase() === "All".toLowerCase())
    {
      let totalPerformance = 0;
      ALL_TOPICS.map((entry) => {
        totalPerformance += progressData[entry].metric
      })
      performance = totalPerformance / ALL_TOPICS.length;
    }

    console.log(topic)

    setStatViewerData({
        Performance: topic.toLowerCase() === "All".toLowerCase() 
          ? performance : progressData[topic].metric,
        Accuracy: numCorrect / numCompletedQuestions,
        AvgScore: pointsEarned / numPointsPossible,
        AvgElapsedTime: totalElapsedTime / numCompletedQuestions,
        NumQuestions: numCompletedQuestions
    })

  }

  /*
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
  */


  const fetchHistory = useCallback(async () => {

    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      
      const response = await api.get<HistoryResponse>("api/progress/history", 
      {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { currentPage, limit: 20 },
      });

      //setHistory(response.data.history);

      response.data.history.map((entry) => {
          allHistory.push(entry);
      })

      setTotalPages(response.data.totalPages);
      setCurrentPage(response.data.currentPage);

      for(let i = currentPage+1; i < totalPages; i++)
      {
        try 
        {
          const response = await api.get<HistoryResponse>("api/progress/history", 
          {
              headers: { 'Authorization': `Bearer ${token}` },
              params: { i, limit: 20 },
          });

          //setHistory(response.data.history);
          response.data.history.map((entry) => {
              allHistory.push(entry);
          })
        }
        catch 
        {
          console.error('Error fetching history');
        }
      }
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

  const fetchProblem = async (entry: HistoryEntry) => {

    setIsLoading(true);
    const token = localStorage.getItem('token');

    try 
    {
      const response = await api.get<RawQuestion>(`api/problems/${entry.problem_id}`, 
      {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      //const problem = response.data;

      return response.data;
    }
    catch
    {
      console.error('Error fetching problem');
    }
    finally
    {
      setIsLoading(false);
    }
  };

  // Fetch user progress data
  const fetchProgressData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');

    try {
      const response = await api.get<{ progress: ProgressData }>("api/progress/graph", 
      {
        headers: 
        {
          'Authorization': `Bearer ${token}`,
        }
      });

      setProgressData(response.data.progress);
    } 
    catch 
    {
      console.error('Error fetching progress data');
    }
  };

  useEffect(() => {
    fetchProgressData();
    fetchHistory();
    //aggregateStats();
  }, [topicChoice]);

  /*
  useEffect(() => {
    const token = localStorage.getItem("token");

    // Fetch user progress data
    const fetchProgressData = async () => {
      try {
        const response = await api.get<{ progress: ProgressData }>("api/progress/graph", 
        {
          headers: 
          {
            'Authorization': `Bearer ${token}`,
          }
        });

        setProgressData(response.data.progress);
      } 
      catch 
      {
        console.error('Error fetching progress data');
      }
    };

    fetchProgressData();
  }, []);
  */

  //setTopicChoice("All");

  return (
    
    <div className="m-1">
      <h2 className="text-2xl font-semibold mb-4">Statistics Viewer</h2>

      {/* Check for loading state */}
      {isLoading ? (
        <p className="text-center text-gray-500">Loading history...</p>
      ) : allHistory.length === 0 ? (
        <p className="text-center">No history yet, but every expert starts somewhere!</p>
      ) : (
        <div className='justify-between'>
            <table className='items-start max-w-1/4'>
                <tbody>
                    <tr>
                        <td>
                            <span>Topic </span>
                            <select onChange={(event) => {
                                let topic: string = event.target.value as string;
                                setTopicChoice(topic);
                                aggregateStats(topic);
                              }}>
                                <option key='0' value="All">All</option>
                                {ALL_TOPICS.map((topic, index) => (
                                    <option key={index+1} value={topic}>{topic}</option>
                                ))};
                            </select>
                        </td>
                    </tr>
                </tbody>
            </table>
                
            <div className="justify-between max-w-1/2">
              
            </div>
        </div>

        /*
        <div className="overflow-hidden rounded-lg shadow-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-800 text-white">
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
                <tr key={index} className={'bg-white border-b border-gray-200 text-left text-gray-700 text-sm uppercase tracking-wide'}>
                  <td className="px-4 py-4 text-center whitespace-nowrap">{new Date(entry.datetime).toLocaleString(undefined, {
                    year:   'numeric',
                    month:  'numeric',
                    day:    'numeric',
                    hour:   'numeric',
                    minute: '2-digit',
                  })}
                  </td>
                  <td className="px-4 py-2 text-center">{formatSubcategoryLabel(entry.topic)}</td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">{entry.type ?? '—'}</td>
                  <td className="px-4 py-2 flex justify-center items-center">
                    <div className={entry.isCorrect ? "flex justify-center items-center rounded-lg py-1 px-2 border border-green-500 bg-green-100 " : "flex justify-center items-center rounded-lg py-1 px-2 border bg-red-100 border-red-500"}>
                      {entry.isCorrect ? <span className='pr-2'>Correct</span> : <span className='pr-2'>Incorrect</span>}
                      {entry.isCorrect ? <Check size={24} strokeWidth={2.5}/> : <X size={24}  strokeWidth={2.5}/>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="rounded-lg py-2 px-3 focus:outline-none hover:scale-110 hover:bg-gray-300"
                      onClick={() => fetchProblem(entry)}
                    >
                        <SquareArrowOutUpRightIcon size={24} strokeWidth={2.5}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        */
      )}
  
    </div>
  );
}  

export default StatsViewer;
