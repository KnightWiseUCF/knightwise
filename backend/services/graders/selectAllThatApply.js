////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          selectAllThatApply.js
//  Description:   Select-all-that-apply question grading.
//
////////////////////////////////////////////////////////////////

/**
 * Grade select-all-that-apply question
 * @param {Array<string>} userAnswers - User's selected answers
 * @param {Array}         allAnswers  - All answer options associated with question
 * @returns {Object}                  - Returns the object shown below:
 *                                      {
 *                                        normalizedScore: number (0.0 to 1.0)
 *                                        feedback:        string
 *                                      }
 */
function gradeSelectAllThatApply(userAnswers, allAnswers) 
{
  const correctAnswers = allAnswers.filter(a => a.IS_CORRECT_ANSWER);
  const correctTexts = new Set(correctAnswers.map(a => a.TEXT.trim().toLowerCase()));
  const userTexts = new Set(userAnswers.map(a => a.trim().toLowerCase()));
  
  let correctSelections = 0;
  let incorrectSelections = 0;
  
  userTexts.forEach(answer => {
    if (correctTexts.has(answer)) 
    {
      correctSelections++;
    } 
    else 
    {
      incorrectSelections++;
    }
  });
    
  // Deduct for incorrectly-chosen answers
  const normalizedScore = Math.max(0, (correctSelections - incorrectSelections) / correctAnswers.length);
  
  return {
    normalizedScore,
    feedback: normalizedScore === 1.0
      ? "Correct! You selected all the right answers." 
      : `Not quite! You selected ${correctSelections} out of ${correctAnswers.length} correct answers.`
  };
}

module.exports = { gradeSelectAllThatApply };
