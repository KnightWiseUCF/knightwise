////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          leaderboard.js
//  Description:   Express routes for leaderboard endpoints.
//                 Protected by JWT authentication.
//
//  Dependencies:  express
//                 authMiddleware
//                 leaderboardController
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { 
        getWeeklyLeaderboard,
        getLifetimeLeaderboard,
        getFollowedWeeklyLeaderboard,
        getFollowedLifetimeLeaderboard,
        getGuildWeeklyLeaderboard,
        getGuildLifetimeLeaderboard,
      } = require('../controllers/leaderboardController');

/**
 * @route   GET /api/leaderboard/weekly
 * @desc    Fetch all users ranked by weekly exp
 * @access  Protected
 */
router.get('/weekly', authMiddleware, getWeeklyLeaderboard);

/**
 * @route   GET /api/leaderboard/lifetime
 * @desc    Fetch all users ranked by lifetime exp
 * @access  Protected
 */
router.get('/lifetime', authMiddleware, getLifetimeLeaderboard);

/**
 * @route   GET /api/leaderboard/followed/weekly
 * @desc    Fetch paginated followed users leaderboard ranked by weekly exp
 * @access  Protected
 */
router.get('/followed/weekly', authMiddleware, getFollowedWeeklyLeaderboard);

/**
 * @route   GET /api/leaderboard/followed/lifetime
 * @desc    Fetch paginated followed users leaderboard ranked by lifetime exp
 * @access  Protected
 */
router.get('/followed/lifetime', authMiddleware, getFollowedLifetimeLeaderboard);

/**
 * @route   GET /api/leaderboard/guilds/weekly
 * @desc    Fetch all guilds ranked by weekly exp
 * @access  Protected
 */
router.get('/guilds/weekly', authMiddleware, getGuildWeeklyLeaderboard);

/**
 * @route   GET /api/leaderboard/guilds/lifetime
 * @desc    Fetch all guilds ranked by lifetime exp
 * @access  Protected
 */
router.get('/guilds/lifetime', authMiddleware, getGuildLifetimeLeaderboard);

module.exports = router;
