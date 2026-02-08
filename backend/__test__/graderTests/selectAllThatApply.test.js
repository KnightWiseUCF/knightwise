////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          selectAllThatApply.test.js
//  Description:   Unit tests for select-all-that-apply grader.
//
//  Dependencies:  selectallThatApply grader
//
////////////////////////////////////////////////////////////////

const { gradeSelectAllThatApply } = require('../../services/graders/selectAllThatApply');

describe("Select-All-That-Apply Grader", () => {
  
  const mockAnswers = [
    { TEXT: 'Python',     IS_CORRECT_ANSWER: 1 },
    { TEXT: 'JavaScript', IS_CORRECT_ANSWER: 1 },
    { TEXT: 'HTML',       IS_CORRECT_ANSWER: 0 },
    { TEXT: 'CSS',        IS_CORRECT_ANSWER: 0 }
  ];

  // Perfect score if user selects all correct answers and no incorrect answers
  describe("Perfect Score Tests", () => {
    
    test("should return 1.0 for all correct selections", () => {
      const result = gradeSelectAllThatApply(['Python', 'JavaScript'], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Correct!');
    });

    test("should be case insensitive", () => {
      const result = gradeSelectAllThatApply(['python', 'JAVASCRIPT'], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Correct!');
    });

    test("should trim whitespace", () => {
      const result = gradeSelectAllThatApply(['  Python  ', ' JavaScript '], mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Correct!');
    });
  });

  describe("Partial Credit Tests", () => {
    
    test("should give 0.5 for selecting only one correct answer", () => {
      const result = gradeSelectAllThatApply(['Python'], mockAnswers);
      
      // (1 correct chosen - 0 incorrect chosen) / 2 correct answers = 0.5
      expect(result.normalizedScore).toBe(0.5);
    });

    test("should penalize incorrect selections", () => {
      const result = gradeSelectAllThatApply(['Python', 'HTML'], mockAnswers);
      
      // (1 correct chosen - 1 incorrect chosen) / 2 correct answers = 0
      expect(result.normalizedScore).toBe(0.0);
    });

    test("should handle mixed correct and incorrect", () => {
      const result = gradeSelectAllThatApply(['Python', 'JavaScript', 'HTML'], mockAnswers);
      
      // (2 correct chosen - 1 incorrect chosen) / 2 correct answers = 0.5
      expect(result.normalizedScore).toBe(0.5);
    });
  });

  describe("Zero Score Tests", () => {
    
    test("should return 0.0 for all incorrect selections", () => {
      const result = gradeSelectAllThatApply(['HTML', 'CSS'], mockAnswers);
      
      // (0 correct chosen - 2 incorrect chosen) / 2 correct answers = -1.0
      // max(0, -1.0) = 0
      expect(result.normalizedScore).toBe(0.0);
    });

    test("should return 0.0 for empty selection", () => {
      const result = gradeSelectAllThatApply([], mockAnswers);
      
      // (0 correct chosen - 0 incorrect chosen) / 2 correct answers = 0.0
      expect(result.normalizedScore).toBe(0.0);
    });

    test("should not return 1.0 when incorrect answers are included", () => {
      // User picked all the correct answers, but also the incorrect ones
      const result = gradeSelectAllThatApply(['Python', 'JavaScript', 'HTML', 'CSS'], mockAnswers);

      // (2 correct chosen - 2 incorrect chosen) / 2 correct answers = 0.0
      expect(result.normalizedScore).toBe(0.0);
    });
  });
});
