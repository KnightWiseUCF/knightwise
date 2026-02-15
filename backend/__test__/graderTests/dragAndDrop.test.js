////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          dragAndDrop.test.js
//  Description:   Unit tests for drag-and-drop grader.
//
//  Dependencies:  dragAndDrop grader
//
////////////////////////////////////////////////////////////////

const { gradeDragAndDrop } = require('../../services/graders/dragAndDrop');

describe("Drag and Drop Grader", () => {
  
  const mockMappings = [
    { TEXT: 'System.out.println();', PLACEMENT: 'Java', IS_CORRECT_ANSWER: 1 },
    { TEXT: 'console.log();', PLACEMENT: 'JavaScript', IS_CORRECT_ANSWER: 1 },
    { TEXT: 'print()', PLACEMENT: 'Python', IS_CORRECT_ANSWER: 1 }
  ];

  describe("Perfect Placement Tests", () => {
    
    test("should return 1.0 for all correct placements", () => {
      const userPlacements = {
        'System.out.println();': 'Java',
        'console.log();': 'JavaScript',
        'print()': 'Python'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      expect(result.normalizedScore).toBe(1.0);
      expect(result.feedback).toContain('Perfect!');
    });

    test("should be case insensitive", () => {
      const userPlacements = {
        'System.out.println();': 'JAVA',
        'console.log();': 'javascript',
        'print()': 'Python'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      expect(result.normalizedScore).toBe(1.0);
    });

    test("should trim whitespace", () => {
      const userPlacements = {
        'System.out.println();': '  Java  ',
        'console.log();': ' JavaScript ',
        'print()': 'Python'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      expect(result.normalizedScore).toBe(1.0);
    });
  });

  describe("Partial Credit Tests", () => {
    
    test("should give partial credit for some correct placements", () => {
      const userPlacements = {
        'System.out.println();': 'Java',
        'console.log();': 'Python', // Wrong!
        'print()': 'Python'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      // 2 out of 3 correct is about 0.667
      expect(result.normalizedScore).toBeCloseTo(0.667);
      expect(result.feedback).toContain('2 out of 3');
    });

    test("should give partial credit for one correct placement", () => {
      const userPlacements = {
        'System.out.println();': 'JavaScript',
        'console.log();': 'Python',
        'print()': 'Python'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      // 1 out of 3 correct is about 0.333
      expect(result.normalizedScore).toBeCloseTo(0.333);
    });
  });

  describe("Zero Score Tests", () => {
    
    test("should return 0.0 for all incorrect placements", () => {
      const userPlacements = {
        'System.out.println();': 'Python',
        'console.log();': 'Java',
        'print()': 'JavaScript'
      };
      
      const result = gradeDragAndDrop(userPlacements, mockMappings);
      
      expect(result.normalizedScore).toBe(0.0);
    });
  });

  // The frontend should guard against this ever happening,
  // but since the grader has a check for this, let's test it.
  describe("Empty User Placement Tests", () => {

    test("should return 0.0 when userPlacements is empty", () => {
      const result = gradeDragAndDrop({}, mockMappings);

      expect(result.normalizedScore).toBe(0.0);
      expect(result.feedback).toContain(`0 out of ${mockMappings.length}`);
    });

    test("should return 0.0 when userPlacements is null/undefined", () => {
      const result1 = gradeDragAndDrop(null, mockMappings);
      const result2 = gradeDragAndDrop(undefined, mockMappings);

      [result1, result2].forEach(res => {
        expect(res.normalizedScore).toBe(0.0);
        expect(res.feedback).toContain(`0 out of ${mockMappings.length}`);
      });
    });
  });

  describe("Error Handling Tests", () => {
    
    test("should throw error if no mappings provided", () => {
      expect(() => {
        gradeDragAndDrop({}, []);
      }).toThrow('No drag and drop mappings found in database');
    });
  });
});
