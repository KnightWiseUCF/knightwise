////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          Graph.tsx
//  Description:   Topic mastery radar chart component.
//
//  Dependencies:  react
//                 react-chartjs-2
//                 chart.js
//                 api instance
//                 models (ProgressData)
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from 'react';
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import api from "../api";
import { ProgressData } from '../models';

// Register required chart elements
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const Graph: React.FC = () => {
  const [progressData, setProgressData] = useState<ProgressData>({});
  
  const allTopics = [
    "Algorithm Analysis", "AVL Trees", "Backtracking", "Base Conversion", "Binary Trees",
    "Bitwise Operators", "Dynamic Memory", "Hash Tables", "Heaps", "Linked Lists",
    "Queues", "Recurrence Relations", "Recursion", "Sorting", "Stacks", "Summations", "Tries"
  ];

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

  // Prepare radar chart data
  const chartData = {
    labels: allTopics,
    datasets: [
      {
        label: "Mastery Level",
        data: allTopics.map(topic => {
          // Set the mastery level (percentage) for each topic
          const topicData = progressData[topic];
          if (topicData !== undefined && topicData.percentage !== undefined) {
            return parseFloat(topicData.percentage.toString());
          }
          return 0;  // Set to 0 if no data is available for this topic
        }),
        backgroundColor: "rgba(255, 201, 4, 0.2)",
        borderColor: "rgba(255, 201, 4, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(255, 201, 4, 1)",
      },
    ],
  };

  const options: ChartOptions<"radar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        suggestedMin: 0,
        suggestedMax: 100,
        angleLines: { color: "rgba(0,0,0,0.2)" },
        grid: { color: "rgba(0,0,0,0.2)" },
        pointLabels: { font: { size: 14 } },
      },
    },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: { 
        enabled: true,
        callbacks: {
          label: function (context: TooltipItem<"radar">) {
            const value = context.raw as number;
            if (value === 0) return ""; // Don't show tooltip for 0 values
            return `Mastery Level: ${value}%`;
          },
        },
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "400px" }}>
      <Radar data={chartData} options={options} />
    </div>
  );
};

export default Graph;
