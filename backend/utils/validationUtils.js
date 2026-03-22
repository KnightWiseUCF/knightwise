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
 * Normalizes a database string (Heaps, Multiple Choice, etc.),
 * removing carriage return and newline escape chars
 * with a global replace. 
 * 
 * The eventual goal is to no longer need this and have
 * the database provide consistent data through enums.
 * 
 * NOTE: Unlike the frontend's formatSubcategoryLabel(),
 *       which turns the canonical InputOutput subcategory
 *       to the displayed Input/Output from API -> frontend, 
 *       this function does the reverse, turning
 *       Input/Output to InputOutput on database -> API,
 *       because some legacy data still has Input/Output when
 *       it should have InputOutput.
 * 
 * @param   {string} str - Raw string from database
 * @returns {string} Normalized string
 */
const normalizeDBString = (str) => {
  return str.replace(/\r\n|\r|\n/g, ' ').trim().replace('Input/Output', 'InputOutput');
}

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
 * Allows Unicode letters, spaces, hyphens, apostrophes, and periods
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
  if (!/^[\p{L}\s'\-\.]+$/u.test(name)) 
  {
    return "Name may only include letters, spaces, hyphens, apostrophes, and periods.";
  }
  return null;
};

module.exports = {
  parseUserId,
  validateName,
  normalizeDBString,
}
