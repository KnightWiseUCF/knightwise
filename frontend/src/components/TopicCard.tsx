import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GitBranch,
  Layers,
  MemoryStick,
  TableProperties,
  Route,
  Repeat,
  ArrowUpDown,
  BarChart2,
  FileCode,
  ArrowRightLeft,
  Braces,
  Text,
  Component,
  Workflow,
  Boxes,
  Network,
  Binary,
  RefreshCcw,
} from "lucide-react";

const topicGroups = [
  {
    title: "Introductory Programming",
    topics: [
      { title: "Input/Output", icon: <ArrowRightLeft size={60} /> },
      { title: "Branching", icon: <GitBranch size={60} /> },
      { title: "Loops", icon: <Repeat size={60} /> },
      { title: "Variables", icon: <Braces size={60} /> },
    ],
  },
  {
    title: "Simple Data Structures",
    topics: [
      { title: "Arrays", icon: <TableProperties size={60} /> },
      { title: "Linked Lists", icon: <Route size={60} /> },
      { title: "Strings", icon: <Text size={60} /> },
    ],
  },
  {
    title: "Object Oriented Programming",
    topics: [
      { title: "Classes", icon: <Component size={60} /> },
      { title: "Methods", icon: <FileCode size={60} /> },
    ],
  },
  {
    title: "Intermediate Data Structures",
    topics: [
      { title: "Trees", icon: <Workflow size={60} /> },
      { title: "Stacks", icon: <Layers size={60} /> },
    ],
  },
  {
    title: "Complex Data Structures",
    topics: [
      { title: "Heaps", icon: <Boxes size={60} /> },
      { title: "Tries", icon: <Network size={60} /> },
    ],
  },
  {
    title: "Intermediate Programming",
    topics: [
      { title: "Bitwise Operators", icon: <Binary size={60} /> },
      { title: "Dynamic Memory", icon: <MemoryStick size={60} /> },
      { title: "Algorithm Analysis", icon: <BarChart2 size={60} /> },
      { title: "Recursion", icon: <RefreshCcw size={60} /> },
      { title: "Sorting", icon: <ArrowUpDown size={60} /> },
    ],
  },
];

const groupColorClasses: Record<string, string> = {
  "Introductory Programming": "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
  "Simple Data Structures": "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
  "Object Oriented Programming": "bg-violet-50 border-violet-200 text-violet-900 hover:bg-violet-100",
  "Intermediate Data Structures": "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
  "Complex Data Structures": "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
  "Intermediate Programming": "bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100",
};

const TopicCard: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleClick = (topicTitle: string) => {
    setSelectedTopic(topicTitle);
    navigate(`/topic-practice/${encodeURIComponent(topicTitle)}`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {topicGroups.map((group, index) => (
        <section
          key={group.title}
          className={`space-y-3 ${index === 0 ? "" : "border-t border-gray-300 pt-5 mt-5"}`}
        >
          <h2 className="text-lg sm:text-xl font-semibold text-gray-600">{group.title}</h2>

          <div className="flex flex-wrap gap-[0.3rem]">
            {group.topics.map((topic) => (
              <button
                key={topic.title}
                onClick={() => handleClick(topic.title)}
                className={`flex flex-col items-center justify-center p-4 border rounded-lg
                  ${selectedTopic === topic.title
                    ? "bg-yellow-500 border-yellow-500 text-black"
                    : groupColorClasses[group.title] || "bg-white border-gray-200 text-gray-800 hover:bg-gray-100"}
                  transition-all shadow-md text-sm sm:text-base font-semibold
                  w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44`}
              >
                <div>{topic.icon}</div>
                <span className="mt-2 text-center">{topic.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default TopicCard;