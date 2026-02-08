////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          fillInTheBlanks.test.js
//  Description:   Unit tests for fill-in-the-blanks grader.
//
//  Dependencies:  fillInTheBlanks grader
//
////////////////////////////////////////////////////////////////

const { gradeFillInTheBlanks } = require('../../services/graders/fillInTheBlanks');

describe("Fill-In-The-Blanks Grader", () => {
  
  const mockAnswers = [
    { TEXT: 'Paris', IS_CORRECT_ANSWER: 1 },
    { TEXT: 'paris', IS_CORRECT_ANSWER: 1 }
  ];

  describe("Correct Answer Tests", () => {
    
    test("should return 1.0 for exact match", () => {
      const result = gradeFillInTheBlanks('Paris', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });

    test("should accept any valid answer", () => {
      const result = gradeFillInTheBlanks('paris', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });

    test("should be case insensitive", () => {
      const result = gradeFillInTheBlanks('PARIS', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });

    test("should trim whitespace", () => {
      const result = gradeFillInTheBlanks('  Paris  ', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });
  });

  describe("Incorrect/Fuzzy Answer Tests", () => {
    
    test("should return 0.0 for wrong answer", () => {
      const result = gradeFillInTheBlanks('London', mockAnswers);
      
      expect(result.normalizedScore).toBe(0.0);
      expect(result.feedback).toContain('Incorrect');
      expect(result.feedback).toContain('Paris');
    });

    test("should return partial credit for close answer", () => {
      const result = gradeFillInTheBlanks('Pari', mockAnswers);
      
      expect(result.normalizedScore).toBeGreaterThan(0);
      expect(result.normalizedScore).toBeLessThan(1);
      expect(result.feedback).toContain('Almost correct');
      expect(result.feedback).toContain('Paris'); // closest answer
    });

    test("should give lower score for worse close answer", () => {
      const closeAnswer = gradeFillInTheBlanks('Pari', mockAnswers);
      const farAnswer = gradeFillInTheBlanks('Pa', mockAnswers);
      expect(farAnswer.normalizedScore).toBeLessThan(closeAnswer.normalizedScore);
    });

    test("should display first acceptable answer in feedback", () => {
      const result = gradeFillInTheBlanks('Berlin', mockAnswers);
      
      expect(result.feedback).toBe('Incorrect. The correct answer is: Paris');
    });

    test("should return 0.0 for empty input", () => {
      const result = gradeFillInTheBlanks('', mockAnswers);
      expect(result.normalizedScore).toBe(0);
      expect(result.feedback).toContain('Incorrect');
    });

  });

  describe("Error Handling Tests", () => {
    
    test("should throw error if no acceptable answers exist", () => {
      expect(() => {
        gradeFillInTheBlanks('Paris', []);
      }).toThrow('No acceptable answers found in database');
    });
  });
});
