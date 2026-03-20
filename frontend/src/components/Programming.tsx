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
//                 topicLabels
//                 axios (isAxiosError)
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { Question } from "../models";
import api from "../api";
import { formatSubcategoryLabel } from "../utils/topicLabels";
import { isAxiosError } from "axios";

type Props = {
  current: Question; // current question
  currentIndex: number; // current index
  total: number; // total number of question
  editorContent: string; // editor content for submission
  setEditorContent: (val: string) => void; // update editor content
  selectedLanguage: string; // language selection for compiler
  setSelectedLanguage: (val: string) => void; // update selected language
  handleSubmit: () => void; // click submit
  handleNext: () => void; // click next
  answered?: boolean; // if user submitted response
  isSubmitting?: boolean; // loading state
  isCorrect?: boolean; // check correct answer
  feedbackText?: string; // optional grader feedback
  pointsEarned?: number | null; // points earned
  pointsPossible?: number | null; // points possible
  normalizedScore?: number | null; // normalized score (0-1)
  passedTests?: number | null; // number of passed test cases
  totalTests?: number | null; // total number of test cases
  submissionsRemaining?: number | null; // number of submits until daily limit reached
};

const Programming: React.FC<Props> = ({
  current,
  currentIndex,
  total,
  editorContent,
  setEditorContent,
  selectedLanguage,
  setSelectedLanguage,
  handleSubmit,
  handleNext,
  answered = false,
  isSubmitting = false,
  isCorrect = false,
  feedbackText,
  pointsEarned,
  pointsPossible,
  normalizedScore,
  passedTests = null,
  totalTests = null,
  submissionsRemaining = null,
}) => {
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [tabSize, setTabSize] = useState<number>(2);
  const [useSpaces, setUseSpaces] = useState<boolean>(true);

  const languages = current.problem?.languages || [];
  const languageOptions = languages.length ? languages : ["C", "C++", "Python", "Java"];

  const languageIds: Record<string, number> = {
    C: 50,
    "C++": 54,
    Java: 62,
    Python: 71,
  };

  const monacoLanguageIds: Record<string, string> = {
    C: "cpp",
    "C++": "cpp",
    Java: "java",
    Python: "python",
  };

  useEffect(() => {
    setConsoleOutput("");
    setIsRunning(false);
  }, [current.ID]);

  const handleRun = async () => {
    const code = editorContent.trim();
    const languageId = languageIds[selectedLanguage];

    if (!code) {
      setConsoleOutput("Please enter code before running.");
      return;
    }

    if (!languageId) {
      setConsoleOutput(`Unsupported language: ${selectedLanguage}`);
      return;
    }

    setIsRunning(true);
    setConsoleOutput("Running code...");

    try {
      const token = localStorage.getItem("token");
      const result = await api.post(
        "/api/code/submitCode",
        {
          problemId: current.ID,
          code: editorContent,
          languageId,
          isTestRun: true,
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const data = result.data;
      // Join only non-empty console lines with spacing for readability.
      const formatConsoleLines = (lines: Array<string | undefined | null>) =>
        lines.filter((line): line is string => Boolean(line)).join("\n\n");

      // Backend returns per-test execution details in testResults.
      // We use the first test case for a quick run-preview output.
      const firstTestResult =
        Array.isArray(data.testResults) && data.testResults.length > 0
          ? data.testResults[0]
          : null;

      // Determine output, execution time, and memory usage 
      let resolvedOutput = "(none)";
      if (firstTestResult && firstTestResult.actualOutput != null) {
        resolvedOutput = firstTestResult.actualOutput;
      } else if (data.stdout != null) {
        resolvedOutput = data.stdout;
      }

      let resolvedExecutionTime = data.executionTime;
      if (firstTestResult && firstTestResult.executionTime != null) {
        resolvedExecutionTime = firstTestResult.executionTime;
      }

      let resolvedMemory = data.memory;
      if (firstTestResult && firstTestResult.memory != null) {
        resolvedMemory = firstTestResult.memory;
      }

      // Normalize error fields that may vary by backend/Judge0 path.
      const resolvedError = data.error || data.compile_output || data.stderr;

      if (data.success) {
        setConsoleOutput(
          formatConsoleLines([
            resolvedOutput,
            resolvedExecutionTime ? `Time: ${resolvedExecutionTime}s` : undefined,
            resolvedMemory ? `Memory: ${resolvedMemory} KB` : undefined,
          ])
        );
      } else {
        setConsoleOutput(
          formatConsoleLines([
            `Status: ${data.status || "Execution failed"}`,
            resolvedError ? `Error Output:\n${resolvedError}` : undefined,
            data.stdout ? `Output:\n${data.stdout}` : undefined,
          ])
        );
      }
    } catch (error) {
      // Log full error details for debugging
      console.error("Code execution error:", error);

      // Test run limit reached
      if (isAxiosError(error) && error.response?.status === 429)
      {
        setConsoleOutput("Daily test run limit for this question exceeded. Submit your response to see your results!");
      }   
      else // All other errors
      { 
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number; data?: { error?: string; message?: string }; statusText?: string } };
          console.error("Backend response:", {
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
          });
          const errorMsg = axiosError.response?.data?.error 
            || axiosError.response?.data?.message
            || axiosError.response?.statusText
            || "Network error occurred";
          setConsoleOutput(`Failed to run code (${axiosError.response?.status || 'unknown'}): ${errorMsg}`);
        } else {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          setConsoleOutput(`Failed to run code: ${errorMessage}`);
        }
      }
    } finally {
      setIsRunning(false);
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
        {formatSubcategoryLabel(current.SUBCATEGORY)}
        <span className="block text-sm sm:text-base md:text-xl text-gray-500 font-normal mt-1 sm:mt-0">
          (Source: {current.AUTHOR_EXAM_ID})
        </span>
      </h1>

      {/* problem description */}
      <h2 className="text-lg font-semibold mb-2">
        Problem {currentIndex + 1} of {total}
      </h2>

      <div className="question-rich-text text-base sm:text-lg md:text-xl font-medium mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
        {parse(DOMPurify.sanitize(current.QUESTION_TEXT))}
      </div>

      {/* code editor */}
      <div className="mb-6 border-t-2 border-gray-300 pt-6">
        <h3 className="text-lg font-semibold mb-3">Your Solution</h3>

        {/* language selection and editor settings */}
        <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
          {/* language buttons */}
          <div className="flex gap-2">
            {languageOptions.map((lang) => (
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
        <div className="border border-gray-400 rounded-lg overflow-hidden bg-gray-900 mb-4">
          <Editor
            height="320px"
            theme="vs-dark"
            value={editorContent}
            language={monacoLanguageIds[selectedLanguage] || "plaintext"}
            onChange={(value) => setEditorContent(value ?? "")}
            options={{
              tabSize,
              insertSpaces: useSpaces,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* run button */}
        <div className="mb-6">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`px-6 sm:px-8 py-2 sm:py-3 rounded font-semibold text-sm text-white ${
              isRunning ? "bg-blue-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>

        {/* console output */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-2">Console Output</h4>
          <div className="p-4 bg-black rounded-lg border border-gray-700 min-h-[120px] max-h-[200px] overflow-auto">
            <pre className="text-gray-300 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words">
              {consoleOutput ||  'Click "Run" to see your code executed with the example input.'}
            </pre>
          </div>
        </div>
      </div>

      {/* grading feedback */}
      {answered && (
        <div className="mb-6">
          {(() => {
            const score = typeof normalizedScore === "number"
              ? normalizedScore
              : isCorrect ? 1 : 0;
            const statusClass = score >= 1
              ? "text-green-600"
              : score > 0.5
              ? "text-yellow-600"
              : "text-red-600";
            const boxClass = score >= 1
              ? "bg-green-50"
              : score > 0.5
              ? "bg-yellow-50"
              : "bg-red-50";
            const borderClass = score >= 1
              ? "border-green-500"
              : score > 0.5
              ? "border-yellow-500"
              : "border-red-500";

            const derivedPointsPossible =
              typeof pointsPossible === "number"
                ? pointsPossible
                : typeof current.POINTS_POSSIBLE === "number"
                ? current.POINTS_POSSIBLE
                : null;
            const derivedPointsEarned =
              typeof pointsEarned === "number"
                ? pointsEarned
                : typeof normalizedScore === "number" && derivedPointsPossible !== null
                ? Math.round(normalizedScore * derivedPointsPossible * 100) / 100
                : null;

            return (
              <div className={`p-4 ${boxClass} rounded border ${borderClass} text-sm sm:text-base md:text-lg`}>
                {feedbackText && (
                  <p className={statusClass}>{feedbackText}</p>
                )}
                <div className="mt-2 text-gray-700 space-y-1">
                  {derivedPointsEarned !== null && derivedPointsPossible !== null && (
                    <p>Points: {derivedPointsEarned} / {derivedPointsPossible}</p>
                  )}
                  {passedTests !== null && totalTests !== null && (
                    <p>Test cases passed: {passedTests} / {totalTests}</p>
                  )}
                </div>
              </div>
            );
          })()}
          {submissionsRemaining === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-400 rounded text-sm text-yellow-800">
              You've now used all your programming submissions for today. Come back tomorrow for more!
            </div>
          )}
        </div>
      )}

      {/* submit/next buttons (next appears after submit) */}
      <div className="flex gap-4 justify-end mt-8 border-t pt-6">
        {!answered ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 sm:px-8 py-2 sm:py-3 rounded-full shadow font-semibold text-sm sm:text-base ${
              isSubmitting
                ? "bg-yellow-200 text-gray-500 cursor-not-allowed"
                : "bg-yellow-400 hover:bg-yellow-500 text-black"
            }`}
          >
            {isSubmitting ? "Grading..." : "Submit"}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 sm:px-8 py-2 sm:py-3 rounded-full shadow font-semibold text-sm sm:text-base bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {currentIndex + 1 === total ? "Result" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
};

export default Programming;
