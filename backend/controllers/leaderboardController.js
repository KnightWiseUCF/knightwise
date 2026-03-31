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
//                 paginationConfig
//
////////////////////////////////////////////////////////////////

const { asyncHandler } = require('../middleware/errorHandler');
const { PAGE_SIZES } = require('../config/paginationConfig');

const FLAIR_SEPARATOR = '|||';

/**
 * Helper function, queries paginated guild leaderboard data for a given exp column
 * Returns a page of guilds ranked by exp
 * Returns the requesting user's guild rank and exp regardless of page,
 * or null if the user is not in a guild.
 *
 * @param {Object} db     - Database connection pool
 * @param {number} userId - Requesting user's ID
 * @param {string} expCol - Column to rank by ('WEEKLY_EXP' or 'LIFETIME_EXP')
 * @param {number} page   - Page number to fetch (1-indexed)
 * @returns {Promise<{ guildRank, guildExp, guildId, page, totalPages, leaderboard }>}
 */
const getGuildLeaderboardData = async (db, userId, expCol, page) =>
{
  // Get total guild count for pagination
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM Guild'
  );

  const totalPages = Math.ceil(total / PAGE_SIZES.LEADERBOARD_GUILD);
  const safePage   = Math.min(Math.max(1, page), totalPages || 1);
  const offset     = (safePage - 1) * PAGE_SIZES.LEADERBOARD_GUILD;

  // Rank guilds and paginate
  // Include guild picture for displaying (mirrors profile picture join for users)
  const [rows] = await db.query(
    `SELECT * FROM (
      SELECT
        g.ID,
        DENSE_RANK() OVER (ORDER BY g.${expCol} DESC) AS \`rank\`,
        g.NAME,
        g.${expCol} AS exp,
        gi.itemName AS guildPicture
      FROM Guild g
      LEFT JOIN (
        SELECT gu.GUILD_ID, si.NAME AS itemName
        FROM GuildUnlock gu
        JOIN StoreItem si ON si.ID = gu.ITEM_ID
        WHERE gu.IS_EQUIPPED = 1 AND si.TYPE = 'profile_picture' AND si.IS_GUILD_ITEM = 1
      ) gi ON gi.GUILD_ID = g.ID
    ) ranked
    ORDER BY \`rank\` ASC, NAME ASC
    LIMIT ? OFFSET ?`,
    [PAGE_SIZES.LEADERBOARD_GUILD, offset]
  );

  // Find requesting user's guild rank and exp regardless of page
  // Returns null fields if user is not in a guild
  const [[membership]] = await db.query(
    'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
    [userId]
  );

  let guildRank = null;
  let guildExp  = null;
  let guildId   = null;

  if (membership)
  {
    guildId = membership.GUILD_ID;
    const [[guildRankRow]] = await db.query(
      `SELECT \`rank\`, exp FROM (
        SELECT
          ID,
          DENSE_RANK() OVER (ORDER BY ${expCol} DESC) AS \`rank\`,
          ${expCol} AS exp
        FROM Guild
      ) ranked
      WHERE ID = ?`,
      [guildId]
    );
    guildRank = guildRankRow?.rank ?? null;
    guildExp  = guildRankRow?.exp  ?? null;
  }

  return {
    guildRank,
    guildExp,
    guildId,
    page:      safePage,
    totalPages,
    leaderboard: rows.map(row => ({
      rank:         row.rank,
      id:           row.ID,
      name:         row.NAME,
      exp:          row.exp,
      guildPicture: row.guildPicture ?? null,
    }))
  };
};

/**
 * Helper function, fetches followed user IDs and queries paginated 
 * leaderboard data for a given exp column.
 * Returns an empty leaderboard if the requesting user follows nobody
 * Called by getFollowedWeeklyLeaderboard() and getFollowedLifetimeLeaderboard()
 *
 * @param {import('express').Request} req - Express request object
 * @param {string} expCol - Column to rank by ('WEEKLY_EXP' or 'LIFETIME_EXP')
 * @returns {Promise<{ userRank, userExp, page, totalPages, leaderboard }>}
 */
const getFollowedLeaderboardData = async (req, expCol) => {
  const [followed] = await req.db.query(
    'SELECT FOLLOWING_ID FROM Follower WHERE FOLLOWER_ID = ?',
    [req.user.id]
  );
  const followedIds = followed.map(f => f.FOLLOWING_ID);

  // Return empty leaderboard if followedIds empty to avoid SQL error
  if (followedIds.length === 0)
  {
    return { userRank: null, userExp: null, page: 1, totalPages: 0, leaderboard: [] };
  }

  // Include the requesting user in the ranked pool so their rank
  // is considered relative to their followed users, not globally
  const poolIds = [...new Set([...followedIds, req.user.id])];

  const page = parseInt(req.query.page) || 1;
  return getLeaderboard(req.db, req.user.id, expCol, page, poolIds);
};

/**
 * Helper function, queries paginated leaderboard data for a given exp column
 * Generic but can be provided filtered IDs for follower leaderboard
 * Returns a page of all users ranked by exp
 * Returns requesting user's rank and exp regardless of page
 *
 * @param {Object}        db        - Database connection pool
 * @param {number}        userId    - Requesting user's ID
 * @param {string}        expCol    - Column to rank by ('WEEKLY_EXP' or 'LIFETIME_EXP')
 * @param {number}        page      - Page number to fetch (1-indexed)
 * @param {number[]|null} filterIds - If provided, only rank these user IDs. null = all users.
 * @returns {Promise<{ userRank, userExp, page, totalPages, leaderboard }>}
 */
const getLeaderboard = async (db, userId, expCol, page, filterIds = null) =>
{
  // Filter IDs based on given argument
  const whereClause = filterIds ? `WHERE u.ID IN (${filterIds.map(() => '?').join(',')})` : '';
  const rankWhereClause  = filterIds ? `WHERE ID IN (${filterIds.map(() => '?').join(',')})` : '';
  const filterParams = filterIds ?? [];

  // Get total filtered user count for pagination
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM User u ${whereClause}`,
    filterParams
  );

  const totalPages = Math.ceil(total / PAGE_SIZES.LEADERBOARD);

  // Ensure page between 1 and totalPages
  const safePage = Math.min(Math.max(1, page), totalPages || 1);
  const offset   = (safePage - 1) * PAGE_SIZES.LEADERBOARD;

  // Rank filtered users and paginate
  // Include username, firstname, profile picture, background, and flairs for displaying
  const [rows] = await db.query(
    `SELECT * FROM (
      SELECT
        u.ID,
        DENSE_RANK() OVER (ORDER BY u.${expCol} DESC) AS \`rank\`,
        u.USERNAME,
        u.FIRSTNAME,
        u.${expCol} AS exp,
        pfp.itemName AS profilePicture,
        bg.itemName AS background,
        (
          SELECT GROUP_CONCAT(si2.NAME ORDER BY si2.NAME SEPARATOR '${FLAIR_SEPARATOR}')
          FROM Purchase p2
          JOIN StoreItem si2 ON si2.ID = p2.ITEM_ID
          WHERE p2.USER_ID = u.ID
            AND p2.IS_EQUIPPED = 1
            AND si2.TYPE = 'flair'
            AND si2.IS_GUILD_ITEM = 0
        ) AS flairNames
      FROM User u
      LEFT JOIN (
        SELECT p.USER_ID, si.NAME as itemName
        FROM Purchase p
        JOIN StoreItem si ON si.ID = p.ITEM_ID
        WHERE p.IS_EQUIPPED = 1 AND si.TYPE = 'profile_picture'
          AND si.IS_GUILD_ITEM = 0
      ) pfp ON pfp.USER_ID = u.ID
      LEFT JOIN (
        SELECT p.USER_ID, si.NAME as itemName
        FROM Purchase p
        JOIN StoreItem si ON si.ID = p.ITEM_ID
        WHERE p.IS_EQUIPPED = 1 AND si.TYPE = 'background'
          AND si.IS_GUILD_ITEM = 0
      ) bg ON bg.USER_ID = u.ID
      ${whereClause}
    ) ranked
    ORDER BY \`rank\` ASC, USERNAME ASC
    LIMIT ? OFFSET ?`,
    [...filterParams, PAGE_SIZES.LEADERBOARD, offset]
  );

  // Find requesting user's rank and exp regardless of page
  const [[userRankRow]] = await db.query(
    `SELECT \`rank\`, exp FROM (
      SELECT
        ID,
        DENSE_RANK() OVER (ORDER BY ${expCol} DESC) AS \`rank\`,
        ${expCol} AS exp
      FROM User
      ${rankWhereClause}
    ) ranked
    WHERE ID = ?`,
    [...(filterIds ?? []), userId]
  );

  return {
    userRank:   userRankRow?.rank ?? null,
    userExp:    userRankRow?.exp  ?? null,
    page:       safePage,
    totalPages,
    leaderboard: rows.map(row => ({
      userId:         row.ID,
      rank:           row.rank,
      username:       row.USERNAME,
      firstName:      row.FIRSTNAME,
      exp:            row.exp,
      profilePicture: row.profilePicture ?? null,
      background:     row.background ?? null,
      flairNames:     typeof row.flairNames === 'string' && row.flairNames.length > 0
        ? row.flairNames.split(FLAIR_SEPARATOR).filter(Boolean)
        : [],
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

/**
 * @route   GET /api/leaderboard/followed/weekly
 * @desc    Fetch paginated followed users leaderboard ranked by weekly exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with follower weekly leaderboard
 */
const getFollowedWeeklyLeaderboard = asyncHandler(async (req, res) =>
{
  const data = await getFollowedLeaderboardData(req, 'WEEKLY_EXP');
  return res.status(200).json(data);
});

/**
 * @route   GET /api/leaderboard/followed/lifetime
 * @desc    Fetch paginated followed users leaderboard ranked by lifetime exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with lifetime leaderboard
 */
const getFollowedLifetimeLeaderboard = asyncHandler(async (req, res) =>
{
  const data = await getFollowedLeaderboardData(req, 'LIFETIME_EXP');
  return res.status(200).json(data);
});

/**
 * @route   GET /api/leaderboard/guilds/weekly
 * @desc    Fetch paginated guild leaderboard ranked by weekly exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with weekly guild leaderboard
 */
const getGuildWeeklyLeaderboard = asyncHandler(async (req, res) =>
{
  const page = parseInt(req.query.page) || 1;
  const data = await getGuildLeaderboardData(req.db, req.user.id, 'WEEKLY_EXP', page);
  return res.status(200).json(data);
});

/**
 * @route   GET /api/leaderboard/guilds/lifetime
 * @desc    Fetch paginated guild leaderboard ranked by lifetime exp
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with lifetime guild leaderboard
 */
const getGuildLifetimeLeaderboard = asyncHandler(async (req, res) =>
{
  const page = parseInt(req.query.page) || 1;
  const data = await getGuildLeaderboardData(req.db, req.user.id, 'LIFETIME_EXP', page);
  return res.status(200).json(data);
});

module.exports = {
  getWeeklyLeaderboard,
  getLifetimeLeaderboard,
  getFollowedWeeklyLeaderboard,
  getFollowedLifetimeLeaderboard,
  getGuildWeeklyLeaderboard,
  getGuildLifetimeLeaderboard,
};
