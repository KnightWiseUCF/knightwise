////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          leaderboardController.js
//  Description:   Controller functions for leaderboard endpoints,
//                 returning weekly and lifetime exp rankings.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const { asyncHandler } = require('../middleware/errorHandler');

// Max number of users shown on a page of the leaderboard
const PAGE_SIZE = 50;

/**
 * Helper function, queries paginated leaderboard data for a given exp column
 * Returns a page of all users ranked by exp
 * Returns requesting user's rank and exp regardless of page
 *
 * @param {Object} db     - Database connection pool
 * @param {number} userId - Requesting user's ID
 * @param {string} expCol - Column to rank by ('WEEKLY_EXP' or 'LIFETIME_EXP')
 * @param {number} page   - Page number to fetch (1-indexed)
 * @returns {Promise<{ userRank, userExp, total, page, totalPages, leaderboard }>}
 */
const getLeaderboard = async (db, userId, expCol, page) =>
{
  // Get total user count for pagination
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM User');
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Ensure page between 1 and totalPages
  const safePage = Math.min(Math.max(1, page), totalPages || 1);
  const offset   = (safePage - 1) * PAGE_SIZE;

  // Rank users and paginate
  // Include username, firstname, and profile picture for displaying
  const [rows] = await db.query(
    `SELECT * FROM (
      SELECT
        u.ID,
        DENSE_RANK() OVER (ORDER BY u.${expCol} DESC) AS \`rank\`,
        u.USERNAME,
        u.FIRSTNAME,
        u.${expCol} AS exp,
        pfp.NAME AS profilePicture
      FROM User u
      LEFT JOIN (
        SELECT p.USER_ID, si.NAME
        FROM Purchase p
        JOIN StoreItem si ON si.ID = p.ITEM_ID
        WHERE p.IS_EQUIPPED = 1 AND si.TYPE = 'profile_picture'
      ) pfp ON pfp.USER_ID = u.ID
    ) ranked
    ORDER BY \`rank\` ASC, USERNAME ASC
    LIMIT ? OFFSET ?`,
    [PAGE_SIZE, offset]
  );

  // Find requesting user's rank and exp regardless of page
  const [[userRankRow]] = await db.query(
    `SELECT \`rank\`, exp FROM (
      SELECT
        ID,
        DENSE_RANK() OVER (ORDER BY ${expCol} DESC) AS \`rank\`,
        ${expCol} AS exp
      FROM User
    ) ranked
    WHERE ID = ?`,
    [userId]
  );

  return {
    userRank:   userRankRow?.rank ?? null,
    userExp:    userRankRow?.exp  ?? null,
    page:       safePage,
    totalPages,
    leaderboard: rows.map(row => ({
      rank:           row.rank,
      username:       row.USERNAME,
      firstName:      row.FIRSTNAME,
      exp:            row.exp,
      profilePicture: row.profilePicture ?? null,
    }))
  };
};

/**
 * @route   GET /api/leaderboard/weekly
 * @desc    Fetch paginated leaderboard ranked by weekly exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with weekly leaderboard
 */
const getWeeklyLeaderboard = asyncHandler(async (req, res) =>
{
  const page = parseInt(req.query.page) || 1;
  const data = await getLeaderboard(req.db, req.user.id, 'WEEKLY_EXP', page);
  return res.status(200).json(data);
});

/**
 * @route   GET /api/leaderboard/lifetime
 * @desc    Fetch paginated leaderboard ranked by lifetime exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with lifetime leaderboard
 */
const getLifetimeLeaderboard = asyncHandler(async (req, res) =>
{
  const page = parseInt(req.query.page) || 1;
  const data = await getLeaderboard(req.db, req.user.id, 'LIFETIME_EXP', page);
  return res.status(200).json(data);
});

module.exports = {
  getWeeklyLeaderboard,
  getLifetimeLeaderboard,
};
