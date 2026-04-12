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
import { useNavigate } from "react-router-dom";
import api from "../api";
import { HistoryEntry, HistoryResponse, ProgressData} from '../models';
import { ALL_TOPICS} from "../utils/topicLabels"

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

interface AggregateData
{
    Performance:    number;
    Accuracy:       number;
    AvgScore:       number;
    AvgElapsedTime: number;
    NumQuestions:   number;
}

const StatsViewer: React.FC = () => {

  const navigate = useNavigate();
  const   [history, setHistory]         = useState<HistoryEntry[]>([]);
  //var allHistory: HistoryEntry[] = [];
  const [progressData, setProgressData] = useState<ProgressData>({});
  const [statViewerData, setStatViewerData] = useState<AggregateData>({
    Performance: 0, 
    Accuracy: 0, 
    AvgScore: 0, 
    AvgElapsedTime:0, 
    NumQuestions: 0});
  const [topicChoice, setTopicChoice] = useState<string>("All");
  const [, setTotalPages]   = useState<number>(1);
  const [isLoading, setIsLoading]     = useState<boolean>(true);

  const nullOrNumToNum = (nullOrNum: number | null | undefined) => {

    return nullOrNum == null || nullOrNum == undefined ? 0 : nullOrNum;
  }

  const aggregateStats = (topic: string) => {

    let numCorrect = 0;
    let numCompletedQuestions = 0;

    let pointsEarned = 0;
    let numPointsPossible = 0;

    let totalElapsedTime = 0;
    let performance = 0;
    
    //console.log(history[0])
    
    for (let i = 0; i < history.length; i++)
    {
      //console.log(topic.toLowerCase() !== "All".toLowerCase())
      //console.log(topic.toLowerCase() !== "All".toLowerCase() || history[i].topic.toLowerCase() !== topic.toLowerCase())


      // If Current History Entry = All or Chosen topic: continue with summing stats
      if(topic.toLowerCase() == 'All'.toLowerCase() || history[i].topic.toLowerCase() == topic.toLowerCase())
      {


        //Add stats
        if (history[i].isCorrect) numCorrect++;
        numCompletedQuestions++;
        pointsEarned += +nullOrNumToNum(history[i].pointsEarned);
        numPointsPossible += +nullOrNumToNum(history[i].pointsPossible);
        totalElapsedTime += nullOrNumToNum(history[i].elapsedTime);

      }

    }

    // If All topics: Add up performences of all topics attempted
    if (topic.toLowerCase() === "All".toLowerCase())
    {
      let totalPerformance = 0;
      let totalTopicsAttempted = 0;
      ALL_TOPICS.map((entry) => {
        totalPerformance += progressData[entry] == null || progressData[entry] == undefined ? 0 : progressData[entry].metric;
        if (progressData[entry] != null && progressData[entry] != undefined) totalTopicsAttempted++;
      })
      performance = totalPerformance / totalTopicsAttempted
    }
    else performance = progressData[topic] == null || progressData[topic] == undefined ? 0 : progressData[topic].metric;

    let statData: AggregateData;

    if (numCompletedQuestions === 0){
      statData = {
        Performance: 0,
        Accuracy: 0,
        AvgScore: 0,
        AvgElapsedTime: 0,
        NumQuestions: 0
      }
    } else {
      statData = {
        Performance: Math.round(performance*100),
        Accuracy: Math.round((numCorrect / numCompletedQuestions)*100),
        AvgScore: Math.round((pointsEarned / numPointsPossible)*100),
        AvgElapsedTime: totalElapsedTime / numCompletedQuestions,
        NumQuestions: numCompletedQuestions
      }
    }

    console.log(statData);

    setStatViewerData(statData);

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
    const allHistory: HistoryEntry[] = [];

    try {
      
      const response = await api.get<HistoryResponse>("api/progress/history", 
      {
          headers: { 'Authorization': `Bearer ${token}` },
          params: { page: 1, limit: 10 },
      });

      response.data.history.map((entry) => {
          allHistory.push(entry);
      })

      setTotalPages(response.data.totalPages);

      for(let i = 2; i <= (response.data.totalPages < 20 ? response.data.totalPages : 20); i++)
      {
        try 
        {
          const response2 = await api.get<HistoryResponse>("api/progress/history", 
          {
              headers: { 'Authorization': `Bearer ${token}` },
              params: { page: i, limit: 10 },
          });

          //setHistory(response.data.history);
          response2.data.history.map((entry) => {
              allHistory.push(entry);
          })
        }
        catch 
        {
          console.error('Error fetching history');
        }
      }

      //console.log(allHistory);
      setHistory(allHistory);

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

      //console.log(response.data.progress)
      setProgressData(response.data.progress);
    } 
    catch 
    {
      console.error('Error fetching progress data');
    }
    finally
    {
      setIsLoading(false)
    }
  };

  useEffect(() => {
    fetchProgressData();
    fetchHistory();
    //aggregateStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicChoice]);

  useEffect(() => {
    fetchProgressData();
    fetchHistory();
    //aggregateStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aggregateStats(topicChoice);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, progressData, topicChoice]);

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

  const generateStatsMessage = () => {
    const seed: number = Math.round(((Math.random()*7)%7)+1)
    console.log(seed)

    if(statViewerData.NumQuestions === 0)
      return "No completed questions? Then I got nothing for you here!"

      if(seed === 1 || seed === 2 ||  seed === 3) //performance
        return statViewerData.Performance > 90 ? "Maybe you'll get an A on a real transcript card for all that work!" 
          : statViewerData.Performance > 70 ? "Performance looking good so far, keep up the good work!" 
          : statViewerData.Performance > 50 ? "Pretty close! Pro-Tip: Speed is key if you can get it right!"
          : statViewerData.Performance > 25 ? "Keep on Practicing this topic! You got this!"
          : "This seems like a struggle area. Keep practicing!"
      else if(seed === 4 ||  seed === 5) //questions completed
        return statViewerData.NumQuestions > 9999 ? "I think that's enough KnightWise for you...." 
          : statViewerData.NumQuestions > 100 ? "Someone's been practicing! Remember to take breaks!" 
          : statViewerData.NumQuestions > 50 ? "That's a lot of questions completed! Good job!"
          : statViewerData.NumQuestions > 25 ? "Go you! Keep up the questions and soon you'll get this down!"
          : statViewerData.NumQuestions > 5 ?  "A few more questions wouldn't hurt. Unless you already know everything."
          : "So few questions, you've got some work to do!"
      else /*(seed === 6 || seed === 7)*/ //elapsed time
        return statViewerData.AvgElapsedTime > 9000 ? "I bet you left your device running while on a question..." 
          : statViewerData.AvgElapsedTime > 120 ? "Taking your time I see... See if you can go faster!" 
          : statViewerData.AvgElapsedTime > 60 ? "Not bad. Pretty quick with that knowledge!"
          : statViewerData.AvgElapsedTime > 15 ? "You're quick to answer! I bet you destroy on Kahoot!"
          : `So Fast! You'real speed demon!`
  }

  const toCanonicalTopicSlug = (topic?: string): string | null => {
    const value = String(topic || "").trim();
    if (!value) {
      return null;
    }
    const normalized = value === "Input/Output" ? "InputOutput" : value;
    return (ALL_TOPICS as readonly string[]).includes(normalized) ? normalized : null;
  };

  const handlePracticeTopic = (topic: string) => {
    const slug = toCanonicalTopicSlug(topic);
    if (!slug) {
      navigate("/topic-practice");
      return;
    }
    navigate(`/topic-practice/${encodeURIComponent(slug)}`);
  };

  const performanceBarHeight = Math.max(12, statViewerData?.Performance ?? 0);
  const scoreBarHeight = Math.max(12, statViewerData?.AvgScore ?? 0);
  const accuracyBarHeight = Math.max(12, statViewerData?.Accuracy ?? 0);
  const useOutsidePerformanceLabel = performanceBarHeight < 28;
  const useOutsideScoreLabel = scoreBarHeight < 28;
  const useOutsideAccuracyLabel = accuracyBarHeight < 28;
    

  return (
    
    <div className="mb-10">

      

      {/* Check for loading state */}
      {isLoading && history.length === 0 ? (
        <p className="text-center text-gray-500">Loading history...</p>
      ) : history.length === 0 ? (
        <p className="text-center">No history yet, but every expert starts somewhere!</p>
      ) : (
        <>
        <div className="mb-2 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="mb-1 w-full text-xl font-semibold sm:mb-4 sm:w-1/2 sm:text-2xl">Statistics Viewer</h2>

          {/* Topic Dropdown*/}
          <div className="flex w-full items-center justify-start sm:justify-end">
            <span className='mb-1 pr-2 text-base font-bold text-gray-900 sm:mb-4 sm:text-lg'>Topic: </span>
            <select className='mb-1 rounded-lg border border-gray-300 bg-gray-100 px-2 py-2 text-sm text-gray-700 sm:mb-4 sm:text-md'
              disabled={isLoading}
              value={topicChoice}
              onChange={(event) => {
                const topic: string = event.target.value as string;
                setTopicChoice(topic);
              }}>
                <option key='0' value="All">All</option>
                {ALL_TOPICS.map((topic, index) => (
                    <option key={index+1} value={topic}>{topic}</option>
                ))};
            </select>
          </div>
        </div>

        <div className={`relative flex min-h-60 w-full flex-col gap-4 rounded-lg border-gray-300 bg-white p-4 shadow lg:flex-row lg:items-stretch lg:justify-between ${isLoading ? 'opacity-80' : ''}`}>

          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
              <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm">
                Updating stats...
              </p>
            </div>
          ) : null}

          {/*Additional Messages*/}
          <div className="flex h-auto w-full flex-col justify-between gap-3 lg:h-50 lg:w-1/4">
            <div className={`flex min-h-24 items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 ${topicChoice === 'All' ? 'h-full' : 'lg:h-30'}`}>
              <p className="text-sm text-blue-500 font-medium tracking-wide">{generateStatsMessage()}</p>
            </div>
            <button
              className="w-full rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-amber-900 hover:bg-amber-200"
              onClick={ () => handlePracticeTopic(topicChoice)}
            >
              {topicChoice === 'All' ? 'Go To Topic Practice' : 'Practice Topic'}
            </button>
          </div>

          {/*Percentage Bars*/}
          <div className="flex h-56 w-full items-end justify-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2 pt-2 sm:gap-6 sm:px-5 lg:h-50 lg:w-1/2">

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-full flex items-end">
                      <div className={`relative w-full rounded-t
                          ${statViewerData?.Performance > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${performanceBarHeight}%`}}

                          title={`${topicChoice}: ${(statViewerData?.Performance)}% Performance`}
                      >
                        {statViewerData?.Performance > 0 && (
                          <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold leading-none pointer-events-none ${useOutsidePerformanceLabel ? "-top-4 text-blue-600" : "top-1 text-white"}`}>
                            {`${statViewerData.Performance}%`}
                          </span>
                        )}
                      </div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Performance</span>
              </div> 

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-20 h-full flex items-end">
                      <div className={`relative w-full rounded-t
                          ${statViewerData?.AvgScore > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${scoreBarHeight}%`}}

                          title={`${topicChoice}: ${(statViewerData?.AvgScore)}% Points Possible Earned`}
                      >
                        {statViewerData?.AvgScore > 0 && (
                          <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold leading-none pointer-events-none ${useOutsideScoreLabel ? "-top-4 text-blue-600" : "top-1 text-white"}`}>
                            {`${statViewerData.AvgScore}%`}
                          </span>
                        )}
                      </div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Score</span>
              </div> 

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-20 h-full flex items-end">
                      <div className={`relative w-full rounded-t
                          ${statViewerData?.Accuracy > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${accuracyBarHeight}%`}}

                          title={`${topicChoice}: ${(statViewerData?.Accuracy)}% Questions Correct`}
                      >
                        {statViewerData?.Accuracy > 0 && (
                          <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold leading-none pointer-events-none ${useOutsideAccuracyLabel ? "-top-4 text-blue-600" : "top-1 text-white"}`}>
                            {`${statViewerData.Accuracy}%`}
                          </span>
                        )}
                      </div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Accuracy</span>
              </div> 
              
          </div>

          {/*Number Stats*/}
          <div className="grid h-auto w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:h-50 lg:w-1/4 lg:grid-cols-1">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200 ">
                  <p className="text-xs text-gray-500 mb-2">Questions Completed</p>
                  <p className="text-2xl font-bold text-gray-800 ">{statViewerData.NumQuestions}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Average Time Per Problem</p>
                  <p className="text-2xl font-bold text-gray-800 ">{statViewerData.AvgElapsedTime > 0 ? `${Math.round(statViewerData.AvgElapsedTime)}s` : "—"}</p>
              </div>

          </div>

        </div>
        </>

      )}
  
    </div>

  );
}  

export default StatsViewer;
