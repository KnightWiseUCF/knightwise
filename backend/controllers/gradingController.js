////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          gradingController.js
//  Description:   Controller functions for grading user responses,
//                 uses grader helper functions.
//
//  Dependencies:  multipleChoice grader
//                 fillInTheBlanks grader
//                 selectAllThatApply grader
//                 rankedChoice grader
//                 dragAndDrop grader
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const { gradeMultipleChoice } = require('../services/graders/multipleChoice');
const { gradeFillInTheBlanks } = require('../services/graders/fillInTheBlanks');
const { gradeSelectAllThatApply } = require('../services/graders/selectAllThatApply');
const { gradeRankedChoice } = require('../services/graders/rankedChoice');
const { gradeDragAndDrop } = require('../services/graders/dragAndDrop');
const { AppError } = require('../middleware/errorHandler');

/**
 * Grade question based on its type and calculate points earned
 * @param {number} questionId     - Question's primary key in database
 * @param {string} questionType   - Type of question
 * @param {*} userAnswer          - User's answer (format varies by type)
 * @param {Array} allAnswers      - All answer options associated with question
 * @param {number} pointsPossible - Maximum points question is worth
 * @returns {Object}              - Returns the object shown below:
 *                                  { 
 *                                    isCorrect:       boolean, 
 *                                    normalizedScore: number, (0.0 to 1.0)
 *                                    pointsEarned:    number, 
 *                                    pointsPossible:  number, 
 *                                    feedback:        string 
 *                                  }
 */
function gradeQuestion(questionId, questionType, userAnswer, allAnswers, pointsPossible) 
{
  let result;  

  // Some graders need all answers, others only need correct answers
  const correctAnswers = allAnswers.filter(a => a.IS_CORRECT_ANSWER);

  switch (questionType) 
  {
    case 'Multiple Choice':
      result = gradeMultipleChoice(userAnswer, allAnswers);
      break;
    case 'Fill In the Blanks':
      result = gradeFillInTheBlanks(userAnswer, correctAnswers);
      break;
    case 'Select All That Apply':
      result = gradeSelectAllThatApply(userAnswer, allAnswers);
      break;
    case 'Ranked Choice':
      result = gradeRankedChoice(userAnswer, correctAnswers);
      break;
    case 'Drag and Drop':
      result = gradeDragAndDrop(userAnswer, correctAnswers);
      break;
    default:
      throw new AppError(
        `Unsupported question type "${questionType}" for question ${questionId}`,
        400,
        'Unsupported question type'
      );
	}
  
  // Calculate points earned by user, round 2 decimal places
  const pointsEarned = Math.round(result.normalizedScore * pointsPossible * 100) / 100;
  
  return {
    isCorrect: result.normalizedScore === 1.0,
    normalizedScore: result.normalizedScore,
    pointsEarned,
    pointsPossible,
    feedback: result.feedback
  };
};

module.exports = { gradeQuestion };
