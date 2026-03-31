////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Dayton Hawk
//  File:          HistoryTable.tsx
//  Description:   My Progress tab's Problem Statistics Viewer
//
//  Dependencies:  react
//                 api instance
//                 models (HistoryEntry, HistoryResponse, ProgressData)
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../api";
import { HistoryEntry, HistoryResponse, ProgressData} from '../models';
import { ALL_TOPICS} from "../utils/topicLabels"

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

  }, [topicChoice, fetchHistory]);

  useEffect(() => {
    fetchProgressData();
    fetchHistory();

  }, [fetchHistory]);

  useEffect(() => {
    aggregateStats(topicChoice);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, progressData, topicChoice]);

  const generateStatsMessage = () => {
    const seed: number = Math.round(((Math.random()*7)%7))
    console.log(seed)

    if(statViewerData.NumQuestions === 0)
      return "No completed questions? Then I got nothing for you here!"

      if(seed === 0 || seed === 1 || seed === 2 ||  seed === 3) //performance
        return statViewerData.Performance > 90 ? "Maybe you'll get an A on a real transcript card for all that work!" 
          : statViewerData.Performance > 70 ? "Performance looking good so far, keep up the good work!" 
          : statViewerData.Performance > 50 ? "Pretty close! Pro-Tip: Speed is key if you can get it right!"
          : statViewerData.Performance > 25 ? "Keep on Practicing this topic! You got this!"
          : "This seems like a struggle area. Keep practicing!"
      else if(seed === 4 ||  seed === 5) //questions completed
        return statViewerData.NumQuestions > 9999 ? "I think that's enough knightWise for you...." 
          : statViewerData.NumQuestions > 100 ? "Someone's been practicing! Remember to take breaks!" 
          : statViewerData.NumQuestions > 50 ? "That's a lot of questions completed! Good job!"
          : statViewerData.NumQuestions > 25 ? "Go you! Keep up the questions and soon you'll get this down!"
          : statViewerData.NumQuestions > 5 ?  "A few more questions wouldn't hurt. Unless you already know everything."
          : "So few questions, you've got some work to do!"
      else /*(seed === 6 || seed === 7)*/ //elapsed time
        return statViewerData.AvgElapsedTime > 9000 ? "I bet you left your device running while on a question..." 
          : statViewerData.AvgElapsedTime > 120 ? "Taking your time I see! See if you can go faster!" 
          : statViewerData.AvgElapsedTime > 60 ? "Pretty good times! Quick with that knowledge!"
          : statViewerData.AvgElapsedTime > 15 ? "You're a quick one to answer! I bet you destroy on Kahoot!"
          : `So Fast! Either you're a CS wizz, rushing, or searching it up.`
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


  return (
    
    <div className="mb-10">

      {/* Check for loading state */}
      {isLoading ? (
        <p className="text-center text-gray-500">Loading history...</p>
      ) : history.length === 0 ? (
        <p className="text-center">No history yet, but every expert starts somewhere!</p>
      ) : (
        <>
        <div className="flex justify-between items-center w-full mb-2">
          <h2 className="text-2xl font-semibold mb-4 w-1/2">Statistics Viewer</h2>

          {/* Topic Dropdown*/}
          <div className="flex justify-end items-center w-full">
            <span className='pr-2 mb-4 text-lg text-gray-900 font-bold'>Topic: </span>
            <select className='border border-gray-300 rounded-lg px-2 mb-4 py-2 text-md text-gray-700 bg-gray-100'
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

        <div className="flex justify-between items-center min-h-60 w-full bg-white border-gray-300 p-4 gap-4 rounded-lg shadow">

          {/*Additional Messages*/}
          <div className="flex grid grid-cols-1 w-1/4 h-50">
            <div className="flex items-center rounded-xl border border-blue-200 bg-blue-50 h-30 px-4 py-2">
              <p className="text-sm text-blue-500 font-medium tracking-wide">{generateStatsMessage()}</p>
            </div>
            {topicChoice !== 'All' ?
            <button className="px-4 py-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
              onClick={ () => handlePracticeTopic(topicChoice)}
            >
              Practice Topic
            </button>
          : null}
          </div>

          {/*Percentage Bars*/}
          <div className="flex justify-center items-end gap-6 h-50 rounded-xl border border-gray-200 bg-white px-5 py-2 pt-2 w-1/2">

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-full flex items-end">
                      <div className={`w-full rounded-t text-white text-center text-sm
                          ${statViewerData?.Performance > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${Math.max(12, statViewerData?.Performance)}%`}}

                          title={`${topicChoice}: ${(statViewerData?.Performance)}% Performance`}
                      >{(statViewerData?.Performance + '%')}</div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Performance</span>
              </div> 

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-20 h-full flex items-end">
                      <div className={`w-full rounded-t text-white text-center text-sm
                          ${statViewerData?.AvgScore > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${Math.max(12, statViewerData?.AvgScore)}%`}}

                          title={`${topicChoice}: ${(statViewerData?.AvgScore)}% Points Possible Earned`}
                      >{(statViewerData?.AvgScore + '%')}</div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Score</span>
              </div> 

              <div className="flex-1 min-w-15 max-w-20 h-full flex flex-col items-center gap-1">
                  <div className="w-full h-20 h-full flex items-end">
                      <div className={`w-full rounded-t text-white text-center text-sm
                          ${statViewerData?.Accuracy > 0  ? "bg-blue-500" : "bg-gray-300"}`}
                          
                          style={{ height: `${Math.max(12, statViewerData?.Accuracy)}%`}}

                          title={`${topicChoice}: ${(statViewerData?.Accuracy)}% Questions Correct`}
                      >{(statViewerData?.Accuracy + '%')}</div>
                  </div>
                  <span className="text-sm text-gray-500 leading-none">Accuracy</span>
              </div> 
              
          </div>

          {/*Number Stats*/}
          <div className="grid grid-cols-1 gap-3 w-1/4 h-50">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200 ">
                  <p className="text-xs text-gray-500 mb-2">Questions Completed</p>
                  <p className="text-2xl font-bold text-gray-800 ">{statViewerData.NumQuestions}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Average Time Per Problem</p>
                  <p className="text-2xl font-bold text-gray-800 ">{statViewerData.AvgElapsedTime}</p>
              </div>

          </div>

        </div>
        </>

      )}
  
    </div>

  );
}  

export default StatsViewer;
