////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          rankedChoice.test.js
//  Description:   Unit tests for ranked choice grader.
//
//  Dependencies:  rankedChoice grader
//
////////////////////////////////////////////////////////////////

const { gradeRankedChoice } = require('../../services/graders/rankedChoice');

describe("Ranked Choice Grader", () => {
  
  const mockAnswers = [
    { TEXT: 'First',  RANK: 1, IS_CORRECT_ANSWER: 1 },
    { TEXT: 'Second', RANK: 2, IS_CORRECT_ANSWER: 1 },
    { TEXT: 'Third',  RANK: 3, IS_CORRECT_ANSWER: 1 },
    { TEXT: 'Fourth', RANK: 4, IS_CORRECT_ANSWER: 1 }
  ];

  describe("Perfect Ranking Tests", () => {
    
    test("should return 1.0 for perfect ranking", () => {
      const result = gradeRankedChoice(['First', 'Second', 'Third', 'Fourth'], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Perfect!');
    });

    test("should be case insensitive", () => {
      const result = gradeRankedChoice(['FIRST', 'second', 'ThIrD', 'Fourth'], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Perfect!');
    });

    test("should trim whitespace", () => {
      const result = gradeRankedChoice(['  First  ', 'Second', 'Third', 'Fourth'], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Perfect!');
    });
  });

  describe("Partial Credit Tests", () => {
    
    test("should give partial credit for one swap", () => {
      // Swap last two items
      const result = gradeRankedChoice(['First', 'Second', 'Fourth', 'Third'], mockAnswers);
      
      // 1 inversion out of max 6 (4 choose 2 = 6)
      // 1 - 1/6 = 5/6, or about 0.833
      expect(result.normalizedScore).toBeCloseTo(0.833);
      expect(result.feedback).toContain('83%');
    });

    test("should give lower score for multiple swaps", () => {
      const result = gradeRankedChoice(['Second', 'Fourth', 'First', 'Third'], mockAnswers);
      
      // 3 inversions, so 1 - 3/6 = 0.5
      expect(result.normalizedScore).toBe(0.5);
      expect(result.feedback).toContain('50%');
    });
  });

  describe("Zero Score Tests", () => {
    
    test("should return 0.0 for completely reversed ranking", () => {
      const result = gradeRankedChoice(['Fourth', 'Third', 'Second', 'First'], mockAnswers);
      
      // Completely reversed, max inversions = 6, so 1 - 6/6 = 0
      expect(result.normalizedScore).toBe(0.0);
      expect(result.feedback).toContain('0%');
    });
  });
});
