////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          rankedChoice.js
//  Description:   Ranked choice question grading.
//                 Graded using Kendall tau distance.
//
////////////////////////////////////////////////////////////////

/**
 * Compute normalized Kendall tau similarity between two rankings,
 * returning a normalized score based on similarity.
 * @param {Array<string>} correctRanking - Correct ranking
 * @param {Array<string>} userRanking    - User ranking
 * @returns {number}                     - Normalized score from 0.0 to 1.0
 */
function kendallTauSimilarity(correctRanking, userRanking) 
{
  const n = correctRanking.length;

  if (n !== userRanking.length) 
  {
    throw new Error("Rankings must be the same length");
  }

  // Map each correct item to its index
  const position = {};
  correctRanking.forEach((item, idx) => {
    position[item] = idx;
  });

  // Convert user ranking to index array
  const ranked = userRanking.map(item => position[item]);

  let inversions = 0;

  // Double for loop is regrettable but it's simpler this way.
  // We could _technically_ have some merge sort shenanigans
  // to speed it up but it would be a lot more code, be terribly
  // unreadable, and wouldn't save us very much time.
  for (let i = 0; i < n; i++) 
  {
    for (let j = i + 1; j < n; j++) 
    {
      if (ranked[i] > ranked[j]) 
      {
        inversions++;
      }
    }
  }

  const maxInversions = (n * (n - 1)) / 2;
  const normalizedScore = (maxInversions === 0 // Let's not divide by 0 here
                          ? 1 
                          : Math.max(0, 1 - inversions / maxInversions));

  return normalizedScore;
}

/**
 * Grade ranked choice question
 * Uses Kendall tau distance for partial credit based on how close ranking is
 * @param {Array<string>} userRanking - User's ranked list of answers
 * @param {Array}      correctAnswers - Correct ranking from DB (sorted by RANK field)
 * @returns {Object}                  - Returns the object shown below:
 *                                      { 
 *                                        normalizedScore: number (0.0 to 1.0),
 *                                        feedback:        string 
 *                                      }
 */
function gradeRankedChoice(userRanking, correctAnswers) 
{
  // Sort correct answers by their RANK field
  const correctRanking = correctAnswers
    .sort((a, b) => a.RANK - b.RANK)
    .map(a => a.TEXT.trim().toLowerCase());
  
  // Process user ranking to compare to correct answer
  const userProcessed = userRanking.map(a => a.trim().toLowerCase());
  
  // Check for perfect match
  const isPerfect = correctRanking.every((item, idx) => item === userProcessed[idx]);
  
  if (isPerfect) 
  {
    return {
      normalizedScore: 1.0,
      feedback: "Perfect! You ranked all items correctly."
    };
  }
  
  // Calculate score with Kendall tau helper function
  const normalizedScore = kendallTauSimilarity(correctRanking, userProcessed);
  
  return {
    normalizedScore,
    feedback: `Not quite! You ordered ${(normalizedScore * 100).toFixed(0)}% of the items correctly.`
  };
}

module.exports = { gradeRankedChoice };
