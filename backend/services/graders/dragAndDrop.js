////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          dragAndDrop.js
//  Description:   Drag and drop question grading.
//
////////////////////////////////////////////////////////////////

/**
 * Grade drag-and-drop question
 * @param {Object} userPlacements  - { itemText: placementCategory } mappings from user
 * 
 *                                   {
 *          Example:                   "System.out.println();": "Java",
 *                                     "console.log()":         "JavaScript"
 *                                   }
 * @param {Array}  correctMappings - Correct mappings from DB
 * @returns {Object}               - Returns the object shown below:
 *                                   { 
 *                                     normalizedScore: number (0.0 to 1.0), 
 *                                     feedback:        string 
 *                                   }
 */
function gradeDragAndDrop(userPlacements, correctMappings) 
{
  let correctPlacements = 0;
  let totalMappings = correctMappings.length;

  if (totalMappings === 0)
  {
    throw new Error('No drag and drop mappings found in database');
  }

  // Frontend should guard against incomplete input but just in case
  if (!userPlacements || Object.keys(userPlacements).length === 0) 
  {
    return {
      normalizedScore: 0.0,
      feedback: `Not quite! You placed 0 out of ${totalMappings} items correctly.`
    };
  }

  correctMappings.forEach(correctAnswer => {
    const itemText = correctAnswer.TEXT;
    const correctPlacement = correctAnswer.PLACEMENT;
    const userPlacement = userPlacements[itemText];
  
    // Process placements for comparison
	  const userProcessed = userPlacement?.trim().toLowerCase();
    const correctProcessed = correctPlacement?.trim().toLowerCase();

    // Check if user has this item in the correct placement
    if (userProcessed === correctProcessed) 
    {
      correctPlacements++;
    }
  });
  
  const normalizedScore = correctPlacements / totalMappings;
  
  return {
    normalizedScore,
    feedback: normalizedScore === 1.0
      ? "Perfect! All items correctly placed."
      : `Not quite! You placed ${correctPlacements} out of ${totalMappings} items correctly.`
  };
}

module.exports = { gradeDragAndDrop };
