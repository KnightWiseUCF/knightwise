import React, { useMemo } from "react";
import logo from "../assets/kw_logo.png";

const taglines = [
  "Conquer your exams.",
  "['hip', 'hip'] Array!",
  "Your path to success starts here.",
  "Also try Terraria!",  
];

const PageTitle: React.FC = () => {
  const randomTagline = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * taglines.length);
    return taglines[randomIndex];
  }, []);

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center">
      <img src={logo} alt="KnightWise Logo" className="w-80 h-auto object-contain mb-4" />
      <h1 className="text-6xl font-bold text-gray-800 mt-6">KnightWise</h1>
      <p className="text-4xl text-gray-600 mt-2">{randomTagline}</p>
    </div>
  );
};

export default PageTitle;
