////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          fillInTheBlanks.js
//  Description:   Fill-in-the-blanks question grading.
//
//  Dependencies:  js-levenshtein
//
////////////////////////////////////////////////////////////////

const levenshtein = require('js-levenshtein');

/**
 * Grade fill-in-the-blank question with fuzzy matching
 * @param {string} userAnswer    - User's typed answer
 * @param {Array} correctAnswers - Array of acceptable answers from database
 * @returns {Object}             - Returns the object shown below: 
 *                                 {
 *                                   normalizedScore: number (0.0 to 1.0), 
 *                                   feedback:        string 
 *                                 }
 */
function gradeFillInTheBlanks(userAnswer, correctAnswers) 
{
  if (!correctAnswers || correctAnswers.length === 0)
  {
    throw new Error('No acceptable answers found in database');
  }

  // This is what we show the user as the correct answer
  const displayAnswer = correctAnswers[0].TEXT;

  // Process user answer to compare with correct answer
  const userProcessed = userAnswer?.trim().toLowerCase();
  
  if (userProcessed)
  {
    // Check for exact match with any acceptable answer
    const isExactMatch = correctAnswers.some(a => 
      a.TEXT.trim().toLowerCase() === userProcessed
    );
    
    if (isExactMatch) 
    {
      return {
        normalizedScore:  1.0,
        feedback:         "Correct!"
      };
    }

    // Check for closest match
    let closestDistance = Infinity;
    let closestAnswer = null;

    correctAnswers.forEach(answer => {
      const distance = levenshtein(userProcessed, answer.TEXT.trim().toLowerCase());
      if (distance < closestDistance) 
      {
        closestDistance = distance;
        closestAnswer = answer.TEXT;
      }
    });

    // Award partial credit based on how closely user input
    // matches the closest valid answer
    const maxLen = Math.max(userProcessed.length, closestAnswer.length);

    // High distance means user was more far off, so lower score
    const normalizedScore = (maxLen === 0) // Let's not divide by 0 here
      ? 1
      : Math.max(0, 1 - closestDistance / maxLen);

    // Arbitrary cutoff point, feedback starts recognizing
    // answer as "almost correct" if score >= 0.5
    const feedback = (normalizedScore >= 0.5)
      ? `Almost correct! The correct answer is: ${closestAnswer}.`
      : `Incorrect. The correct answer is: ${displayAnswer}`;
  
    return {
      normalizedScore: normalizedScore,
      feedback: feedback
    };
  }

  // Empty or null user input (frontend should guard against this)
  return {
    normalizedScore: 0.0,
    feedback: `Incorrect. The correct answer is: ${displayAnswer}`
  };
}

module.exports = { gradeFillInTheBlanks };
