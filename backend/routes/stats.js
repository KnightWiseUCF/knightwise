////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          stats.js
//  Description:   Express routes for aggregate analytics endpoints.
//                 Restricted to professors and admins.
//
//  Dependencies:  express
//                 adminOrProf
//                 statsController
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router  = express.Router();

const adminOrProf = require('../middleware/adminOrProf');
const {
  getAggregateStats,
  getAggregateStatsByQuestion,
} = require('../controllers/statsController');

/**
 * @route   GET /api/stats/aggregate
 * @desc    Aggregate stats across all opted-in users
 * @access  Professor, Admin
 */
router.get('/aggregate', adminOrProf, getAggregateStats);

/**
 * @route   GET /api/stats/aggregate/:questionId
 * @desc    Aggregate stats for a single question across all opted-in users
 * @access  Professor, Admin
 */
router.get('/aggregate/:questionId', adminOrProf, getAggregateStatsByQuestion);

module.exports = router;
