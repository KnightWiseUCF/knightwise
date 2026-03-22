////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          models.ts
//  Description:   Type definitions and interfaces for 
//                 API responses, database models, and
//                 frontend data structures.
//
////////////////////////////////////////////////////////////////

// Store types
// Keep ItemType in sync with ITEM_TYPES in shared/itemConfig.js
export type ItemType = 'flair' | 'profile_picture' | 'background';

export interface StoreItem
{
  ID:   number;
  TYPE: ItemType;
  COST: string; // Decimal in database, arrives as string
  NAME: string;
}

export interface Purchase
{
  USER_ID:     number;
  ITEM_ID:     number;
  IS_EQUIPPED: boolean;
}

export interface PurchasedItem extends StoreItem
{
  IS_EQUIPPED: boolean | number;
}

export interface PurchasesResponse
{
  purchases: PurchasedItem[];
}

export interface StoreItemsResponse
{
  items: StoreItem[];
}

export interface ApiMessageResponse
{
  message: string;
}

//Leaderboard Types
export interface LeaderboardT
{
  rank:           number;
  username:       string;
  firstName:      string;
  exp:            number;
  profilePicture: string;
}

export interface LeaderboardResponse
{
  userRank: number;
  userExp: number;
  page: number;
  totalPages: number;
  leaderboard: LeaderboardT[];
}

// User types
export interface UserInfo
{
  ID:           number;
  USERNAME:     string | null; // While these should never be null, technically
  FIRSTNAME:    string | null; // they can be according to the schema.
  LASTNAME:     string | null;
  DAILY_EXP:    number;
  LIFETIME_EXP: number;
  WEEKLY_EXP:   number;
  COINS:        number;
}

// GET /api/users/:id response
export interface UserInfoResponse
{
  user:          UserInfo;
  equippedItems: StoreItem[];
}

// Question types 
export interface Answer
{
  TEXT:               string;
  IS_CORRECT_ANSWER:  boolean;
  RANK?:              number;
  PLACEMENT?:         string;  // for drag_and_drop: zone/category label
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
  dropZones?:     { id: string; correctAnswer: string }[];                       // For drag_and_drop (old inline style): drop zones with correct answers
  answerObjects?: Answer[];                                                      // For drag_and_drop (placement-based): full answer objects with placement field
  problem?:       { description: string; languages: string[] };                  // For programming: problem metadata
  problemCode?:   { [language: string]: { code: string; output?: string } };     // For programming: code/output by language
}

// History types
export interface HistoryEntry
{
  datetime:       string;
  topic:          string;
  type:           string; // Question.TYPE (Multiple Choice, Programming, etc.)
  isCorrect:      boolean;
  problem_id:     number;
  userAnswer:     string | null; // JSON with answer data
  pointsEarned:   number | null;
  pointsPossible: number | null;
}

export interface HistoryResponse
{
  history:      HistoryEntry[];
  totalPages:   number;
  currentPage:  number;
}

// Problem view types, 
// Used by HistoryTable's ProblemView popup

// Notice how this is a type, not an interface
// Types allow union-like behavior to support varying JSON structure
export type UserAnswer =
  | { type: 'MultipleChoice';     selected:   string }
  | { type: 'FillInTheBlanks';    entered:    string }
  | { type: 'SelectAllThatApply'; selected:   string[] }
  | { type: 'RankedChoice';       order:      string[] }
  | { type: 'DragAndDrop';        placements: Record<string, string> }
  | { type: 'Programming';        language:   string; code: string };
  
// Payload written to localStorage by HistoryTable
// Read by ProblemView component
// Combines question data and user response data
export interface PopupPayload
{
  // From RawQuestion
  questionText:    string;
  category:        string;
  topic:           string;
  type:            string;
  answers:         Answer[];

  // From HistoryEntry
  userAnswer:      string | null; // JSON; parsed into UserAnswer in ProblemView
  pointsEarned:    number | null;
  pointsPossible:  number | null;
  isCorrect:       boolean;
  datetime:        string;
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
