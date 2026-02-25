import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Waypoints, Share2, Layers, ChevronsLeft, Code, MemoryStick,
  TableProperties, Route, ChevronsRight, Repeat, ArrowUpDown, Sigma
} from "lucide-react";

const topics = [
  { title: "Algorithm Analysis", icon: <Waypoints size={60} /> },
  { title: "AVL Trees", icon: <Share2 size={60} style={{ transform: "rotate(90deg)" }} /> },
  { title: "Backtracking", icon: <ChevronsLeft size={60} /> },
  { title: "Base Conversion", icon: <Code size={60} /> },
  { title: "Binary Trees", icon: <Share2 size={60} style={{ transform: "rotate(90deg)" }} /> },
  { title: "Bitwise Operators", icon: <Code size={60} /> },
  { title: "Dynamic Memory", icon: <MemoryStick size={60} /> },
  { title: "Hash Tables", icon: <TableProperties size={60} /> },
  { title: "Heaps", icon: <Share2 size={60} style={{ transform: "rotate(90deg)" }} /> },
  { title: "Linked Lists", icon: <Route size={60} /> },
  { title: "Queues", icon: <ChevronsRight size={60} /> },
  { title: "Recurrence Relations", icon: <Repeat size={60} /> },
  { title: "Recursion", icon: <Repeat size={60} /> },
  { title: "Sorting", icon: <ArrowUpDown size={60} /> },
  { title: "Stacks", icon: <Layers size={60} /> },
  { title: "Loops", icon: <Sigma size={60} /> },
  { title: "Tries", icon: <Share2 size={60} style={{ transform: "rotate(90deg)" }} /> },
];

const TopicCard: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleClick = (topicTitle: string) => {
    setSelectedTopic(topicTitle);
    navigate(`/topic-practice/${encodeURIComponent(topicTitle)}`);
  };

  return (
    // Topic card arrangement change depending on screen size
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 px-4 py-6 justify-items-center w-full max-w-6xl mx-auto">
      {topics.map((topic) => (
        <button
          key={topic.title}
          onClick={() => handleClick(topic.title)}
          className={`flex flex-col items-center justify-center p-4 border rounded-lg
            ${selectedTopic === topic.title ? "bg-yellow-500 text-black" : "bg-white text-gray-800"}
            hover:bg-gray-200 transition-all shadow-md text-sm sm:text-base font-semibold
            w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44`}
        >
          <div>{topic.icon}</div>
          <span className="mt-2 text-center">{topic.title}</span>
        </button>
      ))}
    </div>
  );
};

export default TopicCard;