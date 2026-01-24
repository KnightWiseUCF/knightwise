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
}

// What API returns, before processing
export interface RawQuestion
{
  ID:             number;
  SECTION:        string;
  CATEGORY:       string;
  SUBCATEGORY:    string;
  AUTHOR_EXAM_ID: string;
  QUESTION_TEXT:  string;
  answers?:       Answer[];
}

// What components use after processing, has correct answer
export interface Question 
{
  ID:             number;
  SECTION:        string;
  CATEGORY:       string;
  SUBCATEGORY:    string;
  AUTHOR_EXAM_ID: string;
  QUESTION_TEXT:  string;
  options:        string[];
  answerCorrect:  string;
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
