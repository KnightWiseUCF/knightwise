////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          analyticsConfig.js
//  Description:   Shared config for the KnightWise analytics
//                 engine. Weights are tunable.
//
//  Note:          This file is intentionally .js rather than .ts,
//                 for CommonJS compatibility with our backend Jest.
//                 To make this .ts, the backend Jest would need to 
//                 be configured with ts-jest or similar.
//
////////////////////////////////////////////////////////////////

// Note that all the WEIGHT values below add up to 1.0.

// Weight for normalized score (accuracy). Most important factor.
const WEIGHT_ACCURACY = 0.6;

// Weight for elapsed time. Faster answers score higher.
// But note how this is weighed considerably less
// than accuracy, so users can't abuse this by spamming submits.
const WEIGHT_TIME = 0.15;

// Weight for subcategory difficulty. More advanced topics count more.
const WEIGHT_SUBCATEGORY = 0.15;

// Weight for question type difficulty.
const WEIGHT_TYPE = 0.1;

// Subcategory difficulty scalars (0.0 - 1.0)
// Currently strings match Question.SUBCATEGORY
// If/when subcategories become enums, update keys to match
const SUBCATEGORY_DIFFICULTY = Object.freeze({
  // Introductory Programming
  'Variables':          0.3,
  'InputOutput':        0.3,
  'Branching':          0.3,
  'Loops':              0.3,
  // Simple Data Structures
  'Arrays':             0.5,
  'Linked Lists':       0.5,
  'Strings':            0.5,
  // Object Oriented Programming
  'Methods':            0.6,
  'Classes':            0.6,
  // Intermediate Data Structures
  'Trees':              0.7,
  'Stacks':             0.7,
  // Complex Data Structures
  'Heaps':              0.8,
  'Tries':              0.8,
  // Intermediate Programming
  'Recursion':          0.9,
  'Sorting':            0.9,
  'Algorithm Analysis': 0.9,
  'Dynamic Memory':     0.9,
  'Bitwise Operators':  0.9,
});

// Question type difficulty scalars (0.0 - 1.0)
// Strings must exactly match Question.TYPE
const TYPE_DIFFICULTY = Object.freeze({
  'Multiple Choice':       0.2,
  'Fill in the Blanks':    0.4,
  'Select All That Apply': 0.5,
  'Ranked Choice':         0.6,
  'Drag and Drop':         0.7,
  'Programming':           1.0,
});

// Elapsed time normalization ceiling in seconds
// Responses at or above this value get the worst time score
// Handles users who left mid-question
const MAX_ELAPSED_TIME_SECONDS = 300;

// Fallback difficulty scalar for unknown subcategories/types
// (Ideally we never use this but database string inconsistencies may cause this)
const DEFAULT_DIFFICULTY = 0.5;

module.exports = {
  WEIGHT_ACCURACY,
  WEIGHT_TIME,
  WEIGHT_SUBCATEGORY,
  WEIGHT_TYPE,
  SUBCATEGORY_DIFFICULTY,
  TYPE_DIFFICULTY,
  MAX_ELAPSED_TIME_SECONDS,
  DEFAULT_DIFFICULTY,
};
