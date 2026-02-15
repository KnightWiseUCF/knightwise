////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          models.ts
//  Description:   Database interfaces for type safety. 
//
////////////////////////////////////////////////////////////////

// Question types 
export interface Answer
{
  TEXT:               string;
  IS_CORRECT_ANSWER:  boolean;
  RANK?:              number;
}

// What API returns, before processing
export interface RawQuestion
{
  ID:             number;
  TYPE:           string;
  SECTION:        string;
  CATEGORY:       string;
  SUBCATEGORY:    string;
  AUTHOR_EXAM_ID: string;
  POINTS_POSSIBLE: number;
  QUESTION_TEXT:  string;
  OWNER_ID:       number;
  answers?:       Answer[];
}

// What components use after processing, has correct answer
export interface Question 
{
  ID:             number;
  TYPE:           string;
  SECTION:        string;
  CATEGORY:       string;
  SUBCATEGORY:    string;
  AUTHOR_EXAM_ID: string;
  POINTS_POSSIBLE: number;
  QUESTION_TEXT:  string;
  OWNER_ID:       number;
  options:        string[];
  answerCorrect:  string;
  QUESTION_TYPE: 'multiple_choice' | 'fill_in_blank' | 'select_all_that_apply' | 'ranked_choice' | 'drag_and_drop' | 'programming' | undefined;
  correctOrder:   string[] | undefined;                                          // For ranked_choice: correct ordering of answers
  dropZones?:     { id: string; correctAnswer: string }[];                       // For drag_and_drop: drop zones with correct answers
  problem?:       { description: string; languages: string[] };                  // For programming: problem metadata
  problemCode?:   { [language: string]: { code: string; output?: string } };     // For programming: code/output by language
}

// History types
export interface HistoryEntry
{
  datetime:   string;
  topic:      string;
  isCorrect:  boolean;
  problem_id: number;
}

export interface HistoryResponse
{
  history:      HistoryEntry[];
  totalPages:   number;
  currentPage:  number;
}

// Test types
export interface MockTestResponse 
{
  questions: RawQuestion[];
}

// Progress types
export interface ProgressData
{
  [topic: string]: TopicProgress;
}

export interface TopicProgress
{
  percentage: number;
}
