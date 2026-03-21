////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          statsController.js
//  Description:   Controller functions for aggregate analytics
//                 endpoints. Only includes opted-in users.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 errorHandler
//                 analyticsModel
//
////////////////////////////////////////////////////////////////

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { computeMedian } = require('../utils/analyticsModel');

/**
 * Helper function, computes median accuracy and median elapsed time
 * for a given set of responses
 *
 * @param {Array} responses - Rows from Response JOIN User query
 * @returns {{ medianAccuracy: number|null, medianElapsedTime: number|null }}
 */
const computeAggregateStats = (responses) => {
  const accuracies   = responses.map(r => r.POINTS_POSSIBLE > 0
    ? r.POINTS_EARNED / r.POINTS_POSSIBLE
    : 0
  );
  const elapsedTimes = responses
    .filter(r => r.ELAPSED_TIME != null)
    .map(r => r.ELAPSED_TIME);

  return {
    medianAccuracy:    computeMedian(accuracies),
    medianElapsedTime: computeMedian(elapsedTimes),
  };
};

/**
 * Helper function, groups responses by subcategory and
 * computes aggregate stats per subcategory
 *
 * @param {Array} responses - Rows from Response JOIN User JOIN Question query
 * @returns {Object} Map of subcategory -> { medianAccuracy, medianElapsedTime, responseCount }
 */
const computeSubcategoryBreakdown = (responses) => {
  const bySubcategory = {};
  for (const row of responses)
  {
    const sub = row.SUBCATEGORY ?? 'Unknown';
    if (!bySubcategory[sub]) bySubcategory[sub] = [];
    bySubcategory[sub].push(row);
  }

  const breakdown = {};
  for (const [sub, rows] of Object.entries(bySubcategory))
  {
    const { medianAccuracy, medianElapsedTime } = computeAggregateStats(rows);
    breakdown[sub] = {
      medianAccuracy,
      medianElapsedTime,
      responseCount: rows.length,
    };
  }

  return breakdown;
};

/**
 * @route   GET /api/stats/aggregate
 * @desc    Aggregate median accuracy and elapsed time across all opted-in users
 *          Also returns a per-subcategory breakdown
 * @access  Professor, Admin
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON response with aggregate stats
 */
const getAggregateStats = asyncHandler(async (req, res) => {
  const [responses] = await req.db.query(
    `SELECT r.POINTS_EARNED, r.POINTS_POSSIBLE, r.ELAPSED_TIME, q.SUBCATEGORY
     FROM Response r
     JOIN User u     ON u.ID = r.USERID
     JOIN Question q ON q.ID = r.PROBLEM_ID
     WHERE u.IS_SHARING_STATS = 1`
  );

  if (responses.length === 0)
  {
    return res.status(200).json({
      medianAccuracy:       null,
      medianElapsedTime:    null,
      responseCount:        0,
      subcategoryBreakdown: {},
    });
  }

  const { medianAccuracy, medianElapsedTime } = computeAggregateStats(responses);
  const subcategoryBreakdown = computeSubcategoryBreakdown(responses);

  return res.status(200).json({
    medianAccuracy,
    medianElapsedTime,
    responseCount: responses.length,
    subcategoryBreakdown,
  });
});

/**
 * @route   GET /api/stats/aggregate/:questionId
 * @desc    Aggregate median accuracy and elapsed time for a single question
 *          across all opted-in users
 * @access  Professor, Admin
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - If questionId is not a valid ID
 * @throws  {AppError} 404                 - If question does not exist
 * @returns {Promise<void>}                - Sends HTTP/JSON response with per-question stats
 */
const getAggregateStatsByQuestion = asyncHandler(async (req, res) => {
  const context    = 'getAggregateStatsByQuestion';
  const questionId = parseInt(req.params.questionId);

  if (isNaN(questionId) || questionId <= 0)
  {
    throw new AppError(`[${context}] Invalid question ID: ${req.params.questionId}`, 400, 'Invalid question ID');
  }

  const [[question]] = await req.db.query(
    'SELECT ID FROM Question WHERE ID = ?',
    [questionId]
  );
  if (!question)
  {
    throw new AppError(`[${context}] Question not found: ${questionId}`, 404, 'Question not found');
  }

  const [responses] = await req.db.query(
    `SELECT r.POINTS_EARNED, r.POINTS_POSSIBLE, r.ELAPSED_TIME
     FROM Response r
     JOIN User u ON u.ID = r.USERID
     WHERE r.PROBLEM_ID = ? AND u.IS_SHARING_STATS = 1`,
    [questionId]
  );

  if (responses.length === 0)
  {
    return res.status(200).json({
      questionId,
      medianAccuracy:    null,
      medianElapsedTime: null,
      responseCount:     0,
    });
  }

  const { medianAccuracy, medianElapsedTime } = computeAggregateStats(responses);

  return res.status(200).json({
    questionId,
    medianAccuracy,
    medianElapsedTime,
    responseCount: responses.length,
  });
});

module.exports = {
  getAggregateStats,
  getAggregateStatsByQuestion,
};
