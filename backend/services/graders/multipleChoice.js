////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          multipleChoice.js
//  Description:   Multiple choice question grading.
//
////////////////////////////////////////////////////////////////

/**
 * Grade multiple choice question
 * @param {string} userAnswer      - User's selected answer
 * @param {Array}  allAnswers      - All answer options associated with question
 * @returns {Object}               - Returns the object shown below:
 *                                 { 
 *                                   normalizedScore: number (0.0 or 1.0), 
 *                                   feedback:    	  string 
 *                                 }
 */
function gradeMultipleChoice(userAnswer, allAnswers) 
{
  // Get correct answer
  const correctAnswer = allAnswers.find(a => a.IS_CORRECT_ANSWER);
	if (!correctAnswer)
	{
		throw new Error('No correct answer found in database');
	}

	// Process user answer and correct answer for comparison
	const userProcessed = userAnswer.trim().toLowerCase();
  const correctProcessed = correctAnswer.TEXT.trim().toLowerCase();
	const isCorrect = (userProcessed === correctProcessed);
  
  return {
    normalizedScore: isCorrect ? 1.0 : 0.0,
    feedback: isCorrect 
			? "Correct!" 
			: `Incorrect. The correct answer is: ${correctAnswer.TEXT}`
  };
}

module.exports = { gradeMultipleChoice };
