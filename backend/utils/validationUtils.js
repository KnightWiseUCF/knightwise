////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          validationUtils.js
//  Description:   Utilities and helper functions for
//                 validating/sanitizing input and request params
//                 (e.g. name fields)
//
//  Dependencies:  errorHandler
//
////////////////////////////////////////////////////////////////

const { AppError } = require('../middleware/errorHandler');

/**
 * Parses and validates a user ID from a route parameter
 * 
 * @param {string} rawId       - Raw route parameter (req.params.id)
 * @param {string} [context]   - Caller name for error logging (e.g. 'getUserInfo')
 * @throws {AppError} 400      - If ID is not a valid positive integer
 * @returns {number}           - Validated positive integer user ID
 */
const parseUserId = (rawId, context = 'parseUserId') => {
  const userId = parseInt(rawId);
  if (isNaN(userId) || userId <= 0) 
  {
    throw new AppError(`[${context}] Invalid userId: ${rawId}`, 400, "Invalid user ID");
  }
  return userId;
};

/**
 * Validates a first or last name 
 * Allows accented letters, spaces, hyphens, apostrophes, and periods
 * 
 * Note: Returns error string instead of throwing AppError because
 * this function is technically agnostic of Express/HTTP stuff,
 * so there's no need to couple it to the errorHandler.
 *
 * @param {string} name   - The name string to validate
 * @returns {string|null} - Error message if invalid, null if valid
 */
const validateName = (name) => {
  if (!name || name.trim().length === 0) 
  {
    return "Name is required.";
  }
  if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s'\-\.]+$/.test(name)) 
  {
    return "Name may only include letters, spaces, hyphens, apostrophes, and periods.";
  }
  return null;
};

module.exports = {
  parseUserId,
  validateName,
}
