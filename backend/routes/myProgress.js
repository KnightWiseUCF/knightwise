////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          myProgress.js
//  Description:   User progress tracking routes (history
//                 table, topic mastery, daily streak).
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

/**
 * Helper function to process answers and calculate user progress by topic
 * Calculates number of correct answers, total answers, percentage for each topic.
 * 
 * @param {Array<Object>} answers - Array of answer entries from database
 * @returns {Object} Progress data object with topics as keys, {correct, total, percentage} as values
 */
const processProgressData = (answers) => {
  const progress = {};

  answers.forEach((answer) => {
    const topic = answer.TOPIC;
    const isCorrect = answer.ISCORRECT;

    // Initialize topic if not already in progress
    if (!progress[topic]) 
    {
      progress[topic] = { correct: 0, total: 0 };
    }

    // Increment correct/total answers for the topic
    progress[topic].total += 1;
    if (isCorrect) 
    {
      progress[topic].correct += 1;
    }
  });

  // Calculate percentage or other metrics per topic
  for (const topic in progress) {
    const { correct, total } = progress[topic];
    // Prevent division by 0
    progress[topic].percentage = total > 0 ? ((correct / total) * 100).toFixed(2) : 0;
  }

  return progress;
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
    'SELECT * FROM Response WHERE USERID = ?',
    [userId]
  );

  // If user has no answers yet
  if (userAnswers.length === 0)
  {
    return res.status(200).json({ progress: {} });
  }

  // Process the data to calculate the user's progress (can aggregate by topic/category)
  const progressData = processProgressData(userAnswers);

  res.status(200).json({ progress: progressData });
}));

/**
 * @route   GET /api/progress/messageData
 * @desc    Get user progress data with history, mastery levels, streak
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with history, mastery, streak
 */
router.get("/messageData", authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Fetch all answers from the user
  const [userAnswers] = await req.db.query(
    'SELECT * FROM Response WHERE USERID = ?',
    [userId]
  );

  // Process history and mastery levels
  const history = userAnswers.map(({ DATETIME, TOPIC }) => ({
    datetime: DATETIME,
    topic: TOPIC,
  }));

  // Compute mastery levels
  const mastery = {};
  userAnswers.forEach(({ TOPIC, ISCORRECT }) => {
    if (!mastery[TOPIC]) {
      mastery[TOPIC] = { correct: 0, total: 0 };
    }
    mastery[TOPIC].total += 1;
    if (ISCORRECT) {
      mastery[TOPIC].correct += 1;
    }
  });

  // Convert mastery to percentage
  const masteryLevels = {};
  for (const topic in mastery) {
    const { correct, total } = mastery[topic];
    // Prevent division by 0
    masteryLevels[topic] = total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  // Calculate streak
  const today = new Date().toDateString();
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

  res.status(200).json({ history, mastery: masteryLevels, streak });
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
  
  // Pagination logic: default to page 1, limit to 10 results per page
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  if (page < 1)
  {
    throw new AppError(`Invalid history table page number: ${page}`, 400, "Failed to display history");
  }

  const offset = (page - 1) * limit;  // Calculate the number of results to skip

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
      q.TYPE
    FROM Response r 
    JOIN Question q ON r.PROBLEM_ID = q.ID
    WHERE r.USERID = ? 
    ORDER BY r.DATETIME DESC 
    LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  // Count the total number of entries for pagination
  const [countResults] = await req.db.query(
    'SELECT COUNT(*) as total FROM Response WHERE USERID = ?',
    [userId]
  );
  const totalEntries = countResults[0].total;

  res.status(200).json({
    history: history.map(row => ({
      datetime:       row.DATETIME,
      topic:          row.TOPIC,
      type:           row.TYPE,
      isCorrect:      row.ISCORRECT,
      problem_id:     row.PROBLEM_ID,
      userAnswer:     row.USER_ANSWER,
      pointsEarned:   row.POINTS_EARNED,
      pointsPossible: row.POINTS_POSSIBLE,
    })),
    totalEntries,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalEntries / limit)),
  });
}));

module.exports = router;
