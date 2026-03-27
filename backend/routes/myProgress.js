////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          myProgress.js
//  Description:   User progress tracking routes (history
//                 table, topic mastery, daily streak).
//
//                 Utilizes KnightWise analytics engine
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//                 errorHandler
//                 paginationConfig
//                 analyticsModel
//                 validationUtils
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { PAGE_SIZES } = require('../config/paginationConfig');
const { computePerformanceMetric, computeWeightedTopicMetric } = require('../utils/analyticsModel');
const { normalizeDBString } = require('../utils/validationUtils');

/**
 * Processes response rows into per-topic performance metrics using the analytics model
 * Uses point-weighted averaging so higher-point questions influence topic scores more
 *
 * @param {Array<Object>} responses - Response rows joined with Question (needs TYPE, SUBCATEGORY)
 * @returns {Object} Map of topic -> { metric, responseCount }
 */
const processProgressData = (responses) => {
  const byTopic       = {}; // topic -> array of per-response metrics
  const byTopicPoints = {}; // topic -> array of corresponding pointsPossible values

  for (const row of responses)
  {
    // Prevent database inconsistencies from breaking logic
    const topic = normalizeDBString(row.TOPIC);
    // Initialize topic if not already in progress
    if (!byTopic[topic])
    {
      byTopic[topic]       = [];
      byTopicPoints[topic] = [];
    }

    const normalizedScore = row.POINTS_POSSIBLE > 0
      ? row.POINTS_EARNED / row.POINTS_POSSIBLE
      : 0;

    // Compute performance metric
    byTopic[topic].push(computePerformanceMetric({
      normalizedScore,
      elapsedTime: row.ELAPSED_TIME,
      subcategory: normalizeDBString(row.SUBCATEGORY ?? ''),
      type:        normalizeDBString(row.TYPE ?? ''),
    }));

    // Record points possible for topic weighing
    byTopicPoints[topic].push(parseFloat(row.POINTS_POSSIBLE));
  }

  const result = {};
  for (const [topic, metrics] of Object.entries(byTopic))
  {
    result[topic] = {
      metric:        parseFloat(computeWeightedTopicMetric(metrics, byTopicPoints[topic]).toFixed(4)),
      responseCount: metrics.length,
    };
  }

  return result;
};

/**
 * @route   GET /api/progress/graph
 * @desc    Get user progress data aggregated by topic for graph visualization
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with progress data by topic
 */
router.get('/graph', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  if (!userId)
  {
    throw new AppError("Failed to get graph data, undefined userId", 401, "Unauthorized");
  }

  // Fetch user progress data from the database
  const [userAnswers] = await req.db.query(
    `SELECT r.*, q.TYPE, q.SUBCATEGORY
     FROM Response r
     JOIN Question q ON q.ID = r.PROBLEM_ID
     WHERE r.USERID = ?`,
    [userId]
  );

  // If user has no answers yet
  if (userAnswers.length === 0)
  {
    return res.status(200).json({ progress: {} });
  }

  // Process the data to calculate the user's progress
  const progressData = processProgressData(userAnswers);

  res.status(200).json({ progress: progressData });
}));

/**
 * @route   GET /api/progress/messageData
 * @desc    Get user progress data with mastery levels, strongest/weakest topics, streak
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with mastery, ranked topics, streak
 */
router.get("/messageData", authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // JOIN Question so processProgressData has TYPE and SUBCATEGORY
  const [userAnswers] = await req.db.query(
    `SELECT r.*, q.TYPE, q.SUBCATEGORY
     FROM Response r
     JOIN Question q ON q.ID = r.PROBLEM_ID
     WHERE r.USERID = ?`,
    [userId]
  );

  const progressData  = processProgressData(userAnswers);
  const masteryLevels = Object.fromEntries(
    Object.entries(progressData).map(([topic, { metric }]) => [topic, metric])
  );

  const ranked = Object.entries(progressData)
    .sort(([, a], [, b]) => b.metric - a.metric);

  const strongestTopics = ranked.slice(0, 3).map(([topic]) => topic);
  const weakestTopics   = ranked.slice(-3).reverse().map(([topic]) => topic);

  // Build history for streak calculation
  const history = userAnswers.map(({ DATETIME, TOPIC }) => ({
    datetime: DATETIME,
    topic:    normalizeDBString(TOPIC),
  }));

  // Calculate streak
  const today      = new Date().toDateString();
  const uniqueDays = new Set();
  userAnswers.forEach(({ DATETIME }) => {
    uniqueDays.add(new Date(DATETIME).toDateString());
  });

  // Determine consecutive streak
  let streak = 0;
  const sortedDates = [...uniqueDays]
    .map(dateStr => new Date(dateStr)) // Convert strings to Date objects
    .sort((a, b) => b - a) // Sort by date in descending order (most recent first)
    .map(date => date.toDateString()); // Convert back to strings for the final output

  const now = new Date(today);

  for (const dateStr of sortedDates) {
    const entryDate = new Date(dateStr);
    const diff = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
    if (diff === streak) {
      streak++;
    } else {
      break;
    }
  }

  res.status(200).json({ history, mastery: masteryLevels, strongestTopics, weakestTopics, streak });
}));

/**
 * @route   GET /api/progress/history
 * @desc    Get paginated user submission history
 *          Includes question type, user answer data, and score data
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with paginated history
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Pagination logic: default to page 1
  const page = parseInt(req.query.page) || 1;

  if (page < 1)
  {
    throw new AppError(`Invalid history table page number: ${page}`, 400, "Failed to display history");
  }

  const offset = (page - 1) * PAGE_SIZES.HISTORY_TABLE;

  // Join with corresponding Question to get type
  const [history] = await req.db.query(
    `SELECT
      r.DATETIME,
      r.TOPIC,
      r.ISCORRECT,
      r.PROBLEM_ID,
      r.USER_ANSWER,
      r.POINTS_EARNED,
      r.POINTS_POSSIBLE,
      r.ELAPSED_TIME,
      q.TYPE
     FROM Response r
     JOIN Question q ON r.PROBLEM_ID = q.ID
     WHERE r.USERID = ?
     ORDER BY r.DATETIME DESC
     LIMIT ? OFFSET ?`,
    [userId, PAGE_SIZES.HISTORY_TABLE, offset]
  );

  // Count the total number of entries for pagination
  const [[{ total: totalEntries }]] = await req.db.query(
    'SELECT COUNT(*) as total FROM Response WHERE USERID = ?',
    [userId]
  );

  res.status(200).json({
    history: history.map(row => ({
      datetime:       row.DATETIME,
      // Prevent database inconsistencies from breaking logic
      topic:          normalizeDBString(row.TOPIC),
      type:           row.TYPE,
      isCorrect:      row.ISCORRECT,
      problem_id:     row.PROBLEM_ID,
      userAnswer:     row.USER_ANSWER,
      pointsEarned:   row.POINTS_EARNED,
      pointsPossible: row.POINTS_POSSIBLE,
      elapsedTime:    row.ELAPSED_TIME ?? null,
    })),
    totalEntries,
    currentPage: page,
    totalPages:  Math.max(1, Math.ceil(totalEntries / PAGE_SIZES.HISTORY_TABLE)),
  });
}));

module.exports = router;
