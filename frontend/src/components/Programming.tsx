////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Programming.tsx
//  Description:   Programming problem component with multi-language support.
//
//  Dependencies:  react
//                 html-react-parser
//                 dompurify
//                 models (Question)
//
////////////////////////////////////////////////////////////////

import React, { useState } from "react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Question } from "../models";

type Props = {
  current: Question; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  handleSubmit: () => void; // click submit
  handleNext: () => void; // click next
};

const Programming: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  handleSubmit,
  handleNext,
}) => {
  const [activeTab, setActiveTab] = useState<string>(
    current.problem?.languages[0] || "main.c"
  );
  const [editorContent, setEditorContent] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("C");
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [tabSize, setTabSize] = useState<number>(2);
  const [useSpaces, setUseSpaces] = useState<boolean>(true);

  const languages = current.problem?.languages || [];

  // Calculate line numbers
  const lineCount = editorContent.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const handleRun = () => {
    // Placeholder - actual execution will be handled separately
    setConsoleOutput(`Program executed in ${selectedLanguage}...\nNo output yet.`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Use tab character or spaces based on preference
      const indent = useSpaces ? " ".repeat(tabSize) : "\t";

      // Insert indent at cursor position
      const newContent =
        editorContent.substring(0, start) + indent + editorContent.substring(end);
      setEditorContent(newContent);

      // Move cursor after the inserted indent
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + indent.length;
      }, 0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 mt-12 sm:mt-16 md:mt-20 mb-12">
      {/* top: section, category, subcategory, exam date */}
      <div className="flex flex-col sm:flex-row justify-between mb-2 text-sm sm:text-lg md:text-2xl">
        <p className="text-gray-600">Section {current.SECTION}</p>
        <p className="font-medium">
          Question {currentIndex + 1} of {total}
        </p>
      </div>

      {/* title and exam info */}
      <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-2">
        {current.CATEGORY} <span className="text-yellow-600">&gt;</span>{" "}
        {current.SUBCATEGORY}
        <span className="block text-sm sm:text-base md:text-xl text-gray-500 font-normal mt-1 sm:mt-0">
          (Exam Date: {current.AUTHOR_EXAM_ID})
        </span>
      </h1>

      {/* problem description */}
      <h2 className="text-lg font-semibold mb-2">
        Problem {currentIndex + 1} of {total}
      </h2>

      <div className="text-base sm:text-lg md:text-xl font-medium mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
        {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
      </div>

      {/* language tabs */}
      <div className="mb-4 border-b border-gray-300">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveTab(lang)}
              className={`px-3 sm:px-4 py-2 sm:py-3 font-semibold text-xs sm:text-sm whitespace-nowrap transition ${
                activeTab === lang
                  ? "bg-yellow-400 text-black border-b-2 border-yellow-600"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>


      {/* code editor */}
      <div className="mb-6 border-t-2 border-gray-300 pt-6">
        <h3 className="text-lg font-semibold mb-3">Your Solution</h3>

        {/* language selection and editor settings */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
          {/* language buttons */}
          <div className="flex gap-2">
            {["C", "Python", "Java"].map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-4 sm:px-6 py-2 rounded font-semibold text-sm transition ${
                  selectedLanguage === lang
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* editor settings */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-semibold text-gray-700">Tab Size:</label>
              <select
                value={tabSize}
                onChange={(e) => setTabSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-400 rounded bg-white text-xs sm:text-sm"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-semibold text-gray-700">Indent:</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setUseSpaces(true)}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition ${
                    useSpaces
                      ? "bg-yellow-400 text-black"
                      : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                  }`}
                >
                  Spaces
                </button>
                <button
                  onClick={() => setUseSpaces(false)}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold transition ${
                    !useSpaces
                      ? "bg-yellow-400 text-black"
                      : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                  }`}
                >
                  Tabs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* editor */}
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-900 flex mb-4">
          {/* line numbers */}
          <div className="bg-gray-800 px-4 py-3 text-right min-w-fit">
            <pre className="text-gray-500 font-mono text-xs sm:text-sm leading-6">
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </pre>
          </div>

          {/* editor */}
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck="false"
            placeholder="// Write your solution here..."
            className="flex-1 px-4 py-3 bg-gray-900 text-green-400 font-mono text-xs sm:text-sm resize-none focus:outline-none border-l border-gray-700"
            rows={10}
          />
        </div>

        {/* run button */}
        <div className="mb-6">
          <button
            onClick={handleRun}
            className="px-6 sm:px-8 py-2 sm:py-3 rounded font-semibold text-sm bg-blue-500 hover:bg-blue-600 text-white"
          >
            Run
          </button>
        </div>

        {/* console output */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-2">Console Output</h4>
          <div className="p-4 bg-black rounded-lg border border-gray-700 min-h-[120px] max-h-[200px] overflow-auto">
            <pre className="text-gray-300 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words">
              {consoleOutput || "Run your code to see output here..."}
            </pre>
          </div>
        </div>
      </div>

      {/* submit/next buttons */}
      <div className="flex gap-4 justify-end mt-8 border-t pt-6">
        <button
          onClick={handleSubmit}
          className="px-6 sm:px-8 py-2 sm:py-3 rounded-full shadow font-semibold text-sm sm:text-base bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          Submit
        </button>
        <button
          onClick={handleNext}
          className="px-6 sm:px-8 py-2 sm:py-3 rounded-full shadow font-semibold text-sm sm:text-base bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          {currentIndex + 1 === total ? "Result" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default Programming;
