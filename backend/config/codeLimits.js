////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          codeLimits.js
//  Description:   Config file used to set and check code 
//                 submission limits.
//                 Numbers may need fine-tuning
//
////////////////////////////////////////////////////////////////

// Maximum allowed size of submitted code, in bytes
const MAX_CODE_BYTES = 10000;

// Maximum allowed code submissions a day for an individual user
// Judge0's free cloud tier supports 50 free code submissions per day.
const MAX_SUBMISSIONS_PER_DAY = 10;

// Maximum allowed test runs per problem for an individual user
// Resets per problem daily
const MAX_TEST_RUNS_PER_PROBLEM = 3;

/*
 * Judge0 already enforces the following runtime and memory limits:
 *   cpu_time_limit :5
 *   memory_limit   :256000
 * Which can be found by calling the Get Configuration endpoint on RapidAPI.
 * Still, we may want to enforce our own limits. That's what these constants are for.
 * 
 * // Maximum allowed runtime of submitted code, in milliseconds 
 * const MAX_RUNTIME_MS = TBD
 *
 * // Maximum allowed runtime memory usage of submitted code, in kilobytes
 * const MAX_MEMORY_KB = TBD
 */

/**
 * Checks how many programming question submissions a user has remaining today.
 * @param {object} db     - Database connection
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Number of submissions remaining today (0 means limit reached)
 */
const getProgrammingSubmissionsRemaining = async (db, userId) => {
  const [[{ numDailyResponses }]] = await db.query(
    `SELECT COUNT(*) as numDailyResponses
     FROM Response r
     JOIN Question q ON r.PROBLEM_ID = q.ID
     WHERE r.USERID = ? AND q.TYPE = 'Programming' AND DATE(DATETIME) = CURDATE()`,
    [userId]
  );

  return Math.max(0, MAX_SUBMISSIONS_PER_DAY - numDailyResponses);
};

module.exports = {
    MAX_CODE_BYTES,
    MAX_SUBMISSIONS_PER_DAY,
    MAX_TEST_RUNS_PER_PROBLEM,
    // MAX_RUNTIME_MS,
    // MAX_MEMORY_KB,
    getProgrammingSubmissionsRemaining,
}