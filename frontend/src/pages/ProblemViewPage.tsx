////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          ProblemViewPage.tsx
//  Description:   Popup page that shows problem history info:
//                 Question, correct answer(s), user's submitted
//                 response, earned points data. 
//                 Opened from HistoryTable component.
//
//                 Data passed via unique localStorage key
//                 to allow for transport of large text.
//
//  Dependencies:  react
//                 @monaco-editor/react
//                 models (Answer, UserAnswer, PopupPayload)
//
////////////////////////////////////////////////////////////////

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Answer, UserAnswer, PopupPayload } from '../models';

const TEST_CASES_PER_PROG_QUESTION = 5;

// Helper function, calculates number of test cases passed
// Returns number of test cases passed and total number of test cases
// This is very brittle and relies on every single programming question
// having EXACTLY 5 test cases where each is worth equal point value.
// However, this way we don't have to pass more info to and from the database/backend.
const inferTestCaseData = (earned: number | null, possible: number | null): { passed: number, total: number } | null => {
  if (earned === null || possible === null || possible === 0) 
  {
    return null;
  }
  const score  = earned / possible;
  const passed = Math.round(score * TEST_CASES_PER_PROG_QUESTION);
  return { passed, total: TEST_CASES_PER_PROG_QUESTION };
};

// Helper function, normalize score from 0 to 1
const normalizedScore = (earned: number | null, possible: number | null): number => {
  if (earned === null || possible === null || possible === 0) 
  {
    return 0;
  }
  return earned / possible;
};

// Helper function, returns color styling based on normalized score
const scoreClasses = (score: number) => {
  if (score >= 1) // Correct
  {
    return { border: 'border-green-500',  bg: 'bg-green-50',  text: 'text-green-700'  };
  }
  if (score > 0.5) // Almost correct
  {
    return { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' };
  }
  return   { border: 'border-red-500',    bg: 'bg-red-50',    text: 'text-red-700'    }; // Wrong
};

// Helper function, returns label based on normalized score
const scoreLabel = (score: number) => {
  if (score >= 1)  
  {
    return 'Correct';
  }
  if (score > 0.5)
  {
    return 'Almost correct';
  }
  return 'Incorrect';
};

// Multiple choice view shows user selection and correct answer
const MultipleChoiceView: React.FC<{ answers: Answer[]; userAnswer: UserAnswer }> = ({ answers, userAnswer }) => {
  const selected = (userAnswer.type === 'MultipleChoice') ? userAnswer.selected : null;
  return (
    <div className="space-y-2">
      {answers.map(a => {
        const isCorrect  = a.IS_CORRECT_ANSWER;
        const isSelected = a.TEXT === selected;
        let style = 'border-gray-400 bg-white text-gray-700';
        if (isCorrect && isSelected) // User got it!
        {
          style = 'border-green-500 bg-green-50 text-green-800';
        }
        else if (isCorrect) // User didn't select correct answer
        {
          style = 'border-green-400 bg-green-50 text-green-800';
        }
        else if (isSelected) // User selected wrong answer
        {
          style = 'border-red-400 bg-red-50 text-red-800';
        }
        return (
          <div key={a.TEXT} className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${style}`}>
            <span className="flex-1">{a.TEXT}</span>
            <span className="text-xs font-semibold">
              {
                isSelected && isCorrect   ? 'Your answer ✓' :
                isSelected && !isCorrect  ? 'Your answer ✗' :
                isCorrect  && !isSelected ? 'Correct answer' : null
              }
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Fill in the Blank view shows user input text and correct answer(s) 
const FillInTheBlanksView: React.FC<{ answers: Answer[]; userAnswer: UserAnswer }> = ({ answers, userAnswer }) => {
  const entered = (userAnswer.type === 'FillInTheBlanks') ? userAnswer.entered : '—';
  const correct = answers.filter(a => a.IS_CORRECT_ANSWER).map(a => a.TEXT);
  return (
    <div className="space-y-3">
      <div className="px-4 py-3 rounded-lg border border-gray-400 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 mb-1">Your answer</p>
        <p className="text-base">{entered || <em className="text-gray-400">No answer entered</em>}</p>
      </div>
      <div className="px-4 py-3 rounded-lg border border-green-400 bg-green-50">
        <p className="text-xs font-semibold text-green-600 mb-1">Correct answer</p>
        <p className="text-base text-green-800">{correct[0]}</p>
      </div>
    </div>
  );
};

// Select All That Apply view shows checkmark grid with selected vs correct
const SelectAllView: React.FC<{ answers: Answer[]; userAnswer: UserAnswer }> = ({ answers, userAnswer }) => {
  const selected = (userAnswer.type === 'SelectAllThatApply') ? new Set(userAnswer.selected) : new Set<string>();
  return (
    <div className="space-y-2">
      {answers.map(a => {
        const isCorrect  = a.IS_CORRECT_ANSWER;
        const isSelected = selected.has(a.TEXT);
        const hit   = isCorrect && isSelected;   // User selected rightly
        const miss  = isCorrect && !isSelected;  // User didn't select this, but this was right
        const extra = !isCorrect && isSelected;  // User selected wrongly
        let style = 'border-gray-400 bg-white text-gray-700';
        if (hit)
        {
          style = 'border-green-500 bg-green-50 text-green-800';
        }
        else if (miss)
        {
          style = 'border-yellow-400 bg-yellow-50 text-yellow-800';
        }
        else if (extra)
        {
          style = 'border-red-400 bg-red-50 text-red-800';
        }
        return (
          <div key={a.TEXT} className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${style}`}>
            <span className="flex-1">{a.TEXT}</span>
            <span className="text-xs font-semibold">
              {hit ? '✓ Correct' : miss ? '✗ Missed' : extra ? '✗ Incorrect' : null}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Ranked Choice view shows side-by-side user order vs correct order
const RankedChoiceView: React.FC<{ answers: Answer[]; userAnswer: UserAnswer }> = ({ answers, userAnswer }) => {
  const userOrder    = (userAnswer.type === 'RankedChoice') ? userAnswer.order : [];
  const correctOrder = [...answers].sort((a, b) => (a.RANK ?? 0) - (b.RANK ?? 0)).map(a => a.TEXT);
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">Your order</p>
        <ol className="space-y-1">
          {userOrder.map((item, i) => {
            const correct = (correctOrder[i] === item);
            return (
              <li key={i} className={`px-3 py-2 rounded border text-sm ${correct ? 'border-green-400 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
                {correct ? '✓' : '✗'} {i + 1}. {item}
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">Correct order</p>
        <ol className="space-y-1">
          {correctOrder.map((item, i) => (
            <li key={i} className="px-3 py-2 rounded border border-green-400 bg-green-50 text-green-800 text-sm">
              {i + 1}. {item}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

// Drag and Drop view shows answers in their correct placement zones
const DragAndDropView: React.FC<{ answers: Answer[]; userAnswer: UserAnswer }> = ({ answers, userAnswer }) => {
  const placements = (userAnswer.type === 'DragAndDrop') ? userAnswer.placements : {};

  // Group correct answers by placement zone
  const correctByPlacement: Record<string, string[]> = {};
  answers.filter(a => a.PLACEMENT).forEach(a => {
    const p = a.PLACEMENT!;

    if (!correctByPlacement[p])
    {
      correctByPlacement[p] = [];
    }

    correctByPlacement[p].push(a.TEXT);
  });

  // Group user answers by placement zone
  const userByPlacement: Record<string, string[]> = {};
  Object.entries(placements).forEach(([answerText, zone]) => {

    if (!userByPlacement[zone]) 
    {
      userByPlacement[zone] = [];
    }

    userByPlacement[zone].push(answerText);
  });

  const allZones = Array.from(new Set(
  [
    ...Object.keys(correctByPlacement),
    ...Object.keys(userByPlacement)
  ])).sort();

  return (
    <div className="space-y-4">
      {allZones.map(zone => {
        const userItems    = userByPlacement[zone]    ?? [];
        const correctItems = correctByPlacement[zone] ?? [];
        return (
          <div key={zone} className="rounded-lg border border-gray-400 overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 font-semibold text-sm text-gray-700">
              {zone}
            </div>
            <div className="grid grid-cols-2 gap-4 p-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Your answer</p>
                {userItems.length > 0
                  ? userItems.map((item, i) => {
                      const correct = correctItems.includes(item);
                      return (
                        <p key={i} className={`text-sm px-2 py-1 rounded ${correct ? 'text-green-700 bg-green-50 border border-green-300' : 'text-red-700 bg-red-50 border border-red-300'}`}>
                          {correct ? '✓' : '✗'} {item}
                        </p>
                      );
                  })
                  // This should never happen! Frontend requires all user placements for submission. But just in case.
                  : <p className="text-sm text-gray-400 italic">Nothing placed</p>
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Correct answer</p>
                {correctItems.map((item, i) => (
                  <p key={i} className="text-sm px-2 py-1 rounded text-green-700 bg-green-50 border border-green-300">{item}</p>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Programming view shows Monaco read-only editor and score
const ProgrammingView: React.FC<{ userAnswer: UserAnswer; pointsEarned: number | null; pointsPossible: number | null }> = ({
  userAnswer,
  pointsEarned,
  pointsPossible,
}) => {
  const language = (userAnswer.type === 'Programming') ? userAnswer.language : 'plaintext';
  const code     = (userAnswer.type === 'Programming') ? userAnswer.code     : '';

  // Map our language names to Monaco language IDs (keep in sync with Programming.tsx)
  const monacoLanguageIds: Record<string, string> = { C: 'cpp', 'C++': 'cpp', Java: 'java', Python: 'python' };
  const monacoLang = monacoLanguageIds[language] ?? 'plaintext';

  // Number of passed test cases inferred from points earned
  const testCaseData = inferTestCaseData(pointsEarned, pointsPossible);

  return (
    <div className="space-y-4">

      {/* Test cases passed */}
      {testCaseData !== null && (
        <div className="px-4 py-3 rounded-lg border border-gray-400 bg-gray-100 text-gray-800 text-sm">
          <span className="font-semibold">Test cases passed: </span>
          {testCaseData.passed} / {testCaseData.total}
        </div>
      )}

      {/* Language badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Language:</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
          {language}
        </span>
      </div>

      {/* Monaco editor (read-only) */}
      <div className="rounded-lg overflow-hidden border border-gray-700">
        <div className="px-3 py-1.5 bg-gray-800 text-gray-300 text-xs font-semibold">
          Submitted code
        </div>
        <Editor
          height="280px"
          theme="vs-dark"
          language={monacoLang}
          value={code}
          options={{
            readOnly:              true,
            minimap:               { enabled: false },
            fontSize:              13,
            wordWrap:              'on',
            scrollBeyondLastLine:  false,
            automaticLayout:       true,
            // Hide cursor and line highlight so it's obviously read-only
            renderLineHighlight:   'none',
            cursorStyle:           'underline',
            cursorBlinking:        'solid',
          }}
        />
      </div>
    </div>
  );
};

// Main ProblemView component
const ProblemView: React.FC = () => {
  const [payload, setPayload] = useState<PopupPayload | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // Read localStorage key from query string
    const params     = new URLSearchParams(window.location.search);
    const storageKey = params.get('key');

    if (!storageKey) 
    {
      setError('No data key provided.');
      return;
    }

    // Poll every 50 ms until HistoryTable writes to localStorage
    const interval = setInterval(() => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return; // Hasn't happened yet...

      clearInterval(interval);
      clearTimeout(timeout);

      try
      {
        const data: PopupPayload = JSON.parse(raw);
        setPayload(data);
      }
      catch
      {
        setError('Failed to parse problem data.');
      }
    }, 50);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setError('Problem data not found. The request may have timed out.');
    }, 10000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  // Separate cleanup useEffect to remove key from localStorage
  // If cleanup is put in the previous useEffect it cleans up
  // too early thanks to React StrictMode double invocation (race condition)
  useEffect(() => {
    if (!payload) return;
    const params     = new URLSearchParams(window.location.search);
    const storageKey = params.get('key');
    if (storageKey) localStorage.removeItem(storageKey);
  }, [payload]);

  if (error) 
  {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  if (!payload) 
  {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading problem...</p>
      </div>
    );
  }

  // Parse stored user answer
  let userAnswer: UserAnswer | null = null;
  if (payload.userAnswer) 
  {
    try 
    {
      userAnswer = JSON.parse(payload.userAnswer) as UserAnswer;
    } 
    catch 
    {
      // Force to plaintext for backward compatibility
      userAnswer = { type: 'Programming', language: 'Unknown', code: payload.userAnswer };
    }
  }

  const score   = normalizedScore(payload.pointsEarned, payload.pointsPossible);
  const colors  = scoreClasses(score);
  const label   = scoreLabel(score);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {payload.category} <span className="text-yellow-600">&gt;</span> {payload.topic}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date(payload.datetime).toLocaleString(undefined, {
            year:   'numeric',
            month:  'numeric',
            day:    'numeric',
            hour:   'numeric',
            minute: '2-digit',
          })}
          &nbsp;·&nbsp;
          <span className="font-medium text-gray-500">{payload.type}</span>
        </p>
      </div>

      {/* Score badge */}
      <div className={`px-4 py-3 rounded-lg border ${colors.border} ${colors.bg}`}>
        <p className={`font-semibold ${colors.text}`}>{label}</p>
        {payload.pointsPossible !== null && (
          <p className={`text-sm mt-0.5 ${colors.text}`}>
            {payload.pointsEarned ?? 0} / {payload.pointsPossible} pts
            &nbsp;({Math.round(score * 100)}%)
          </p>
        )}
      </div>

      {/* Question text */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Question</h2>
        <div
          className="text-base text-gray-800 leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: payload.questionText }}
        />
      </div>

      {/* Answer comparison */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {payload.type === 'Programming' ? 'Your Submission' : 'Correct Answer'}
        </h2>

        {userAnswer === null ? (
          <p className="text-gray-400 italic">No answer data available for this submission.</p>
        ) : payload.type === 'Multiple Choice' ? (
          <MultipleChoiceView answers={payload.answers} userAnswer={userAnswer} />
        ) : payload.type === 'Fill in the Blanks' ? (
          <FillInTheBlanksView answers={payload.answers} userAnswer={userAnswer} />
        ) : payload.type === 'Select All That Apply' ? (
          <SelectAllView answers={payload.answers} userAnswer={userAnswer} />
        ) : payload.type === 'Ranked Choice' ? (
          <RankedChoiceView answers={payload.answers} userAnswer={userAnswer} />
        ) : payload.type === 'Drag and Drop' ? (
          <DragAndDropView answers={payload.answers} userAnswer={userAnswer} />
        ) : payload.type === 'Programming' ? (
          <ProgrammingView 
            userAnswer      = {userAnswer}
            pointsEarned    = {payload.pointsEarned}
            pointsPossible  = {payload.pointsPossible}
          />
        ) : (
          // Unkown question type fallback
          <div className="px-4 py-3 rounded-lg border border-gray-400 bg-gray-50 text-sm text-gray-600">
            <pre className="whitespace-pre-wrap break-words">{payload.userAnswer}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemView;
