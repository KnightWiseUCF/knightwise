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
const { getWeeklyLeaderboard, getLifetimeLeaderboard } = require('../controllers/leaderboardController');

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

module.exports = router;
