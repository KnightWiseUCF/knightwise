////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     KnightWise Team
//  File:          topicLabels.ts
//  Description:   Contains topic label constants and
//                 helpers for topic label displaying.
//
////////////////////////////////////////////////////////////////

// This is used in matching data received from the API,
// so canonical names (InputOutput) must be used.
// When displaying, use formatSubcategoryLabel().
export const ALL_TOPICS = [
  "InputOutput", // Canonical name, display name is Input/Output
  "Branching",
  "Loops",
  "Variables",
  "Arrays",
  "Linked Lists",
  "Strings",
  "Classes",
  "Methods",
  "Trees",
  "Stacks",
  "Heaps",
  "Tries",
  "Bitwise Operators",
  "Dynamic Memory",
  "Algorithm Analysis",
  "Recursion",
  "Sorting",
] as const;

export const formatSubcategoryLabel = (subcategory?: string): string => {
  const value = String(subcategory || "").trim();
  if (!value) {
    return "";
  }

  return value === "InputOutput" ? "Input/Output" : value;
};