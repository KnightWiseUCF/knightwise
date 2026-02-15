////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          multipleChoice.test.js
//  Description:   Unit tests for multiple choice grader.
//
//  Dependencies:  multipleChoice grader
//
////////////////////////////////////////////////////////////////

const { gradeMultipleChoice } = require('../../services/graders/multipleChoice');

describe("Multiple Choice Grader", () => {
  
  const mockAnswers = [
    { TEXT: 'Paris',  IS_CORRECT_ANSWER: 1 },
    { TEXT: 'London', IS_CORRECT_ANSWER: 0 },
    { TEXT: 'Berlin', IS_CORRECT_ANSWER: 0 },
    { TEXT: 'Madrid', IS_CORRECT_ANSWER: 0 }
  ];

  describe("Correct Answer Tests", () => {
    
    test("should return 1.0 for correct answer", () => {
      const result = gradeMultipleChoice('Paris', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });

    test("should be case insensitive", () => {
      const result = gradeMultipleChoice('PARIS', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });

    test("should trim whitespace", () => {
      const result = gradeMultipleChoice('  Paris  ', mockAnswers);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toBe('Correct!');
    });
  });

  describe("Incorrect Answer Tests", () => {
    
    test("should return 0.0 for wrong answer", () => {
      const result = gradeMultipleChoice('London', mockAnswers);
      
      expect(result.normalizedScore).toBe(0.0);
      expect(result.feedback).toContain('Incorrect');
      expect(result.feedback).toContain('Paris');
    });

    test("should provide correct answer in feedback", () => {
      const result = gradeMultipleChoice('Berlin', mockAnswers);
      
      expect(result.feedback).toBe('Incorrect. The correct answer is: Paris');
    });
  });

  describe("Error Handling Tests", () => {
    
    test("should throw error if no correct answer exists", () => {
      const badAnswers = [
        { TEXT: 'Paris', IS_CORRECT_ANSWER: 0 },
        { TEXT: 'London', IS_CORRECT_ANSWER: 0 }
      ];
      
      expect(() => {
        gradeMultipleChoice('Paris', badAnswers);
      }).toThrow('No correct answer found in database');
    });
  });
});
