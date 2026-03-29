////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          problems.js
//  Description:   Routes for fetching question data.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//                 errorHandler
//                 paginationConfig
//                 adminOrProf middleware
//                 validationUtils
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { PAGE_SIZES } = require('../config/paginationConfig');
const adminOrProf = require('../middleware/adminOrProf');
const { normalizeDBString } = require('../utils/validationUtils');

/**
 * Helper function, gets answers for a given question
 * @param {number} questionId - Question ID
 * @param {Object} db         - Database connection pool
 * @returns {Promise<Array>}  - Array of answers
 */
const getAnswersForQuestion = async (questionId, db) => {
  const [answers] = await db.query(
    'SELECT * FROM AnswerText WHERE QUESTION_ID = ?',
    [questionId]
  );
  return answers;
};

/**
 * @route   GET /api/problems/:id
 * @desc    Fetch a question by its ID with its associated answers
 *          Only fetches published questions
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with question and its answers
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find question by ID
  const [questions] = await req.db.query(
    'SELECT * FROM Question WHERE ID = ? AND IS_PUBLISHED = 1',
    [id]
  );

  if (questions.length === 0) 
  {
    throw new AppError(`No published questions associated with ID: ${id}`, 404, "Question not found");
  }

  const question = questions[0];

  // Get answers for question
  const answers = await getAnswersForQuestion(id, req.db);

  res.json({...question, answers});
}));

/**
 * @route   GET /api/problems
 * @desc    Fetch all published questions broken down by subcategory, paginated.
 *          Optional query params:
 *            - mine=true  : only return questions owned by the requesting professor
 *            - subcategory: filter subcategory, can provide comma separated list (case-insensitive)
 *            - page       : page number (default 1, clamped to valid range)
 *          Page size is controlled by PAGE_SIZES.PROF_QUESTIONS.
 *
 * @access  Professor, Admin
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with paginated questions grouped by subcategory
 */
router.get('/', adminOrProf, asyncHandler(async (req, res) => {
  // Get query params and page size config
  const mineOnly  = req.query.mine === 'true';
  const rawPage   = parseInt(req.query.page);
  const pageSize  = PAGE_SIZES.PROF_QUESTIONS;

  // Support single or comma-separated subcategory values
  // e.g. ?subcategory=Arrays
  //      ?subcategory=Arrays,Recursion,Sorting
  // Omit param entirely to get all subcategories
  const subcategories = req.query.subcategory
    ? req.query.subcategory.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  // Start building WHERE clause
  const conditions = ['q.IS_PUBLISHED = 1'];
  const params     = [];

  // mineOnly applies only to professors
  if (mineOnly && req.user?.role === 'professor')
  {
    const profId = req.user?.id;
    if (!profId)
    {
      throw new AppError('Professor ID is undefined', 403, 'Failed to verify professor identity');
    }
    // Add owner filter
    conditions.push('q.OWNER_ID = ?');
    params.push(profId);
  }

  if (subcategories && subcategories.length > 0)
  {
    // Add subcategory filter (case-insensitive)
    conditions.push('LOWER(q.SUBCATEGORY) IN (?)');
    params.push(subcategories.map(s => s.toLowerCase()));
  }

  // Finish building WHERE clause
  const whereClause = conditions.join(' AND ');

  // Get total count for pagination
  const [[{ total }]] = await req.db.query(
    `SELECT COUNT(*) AS total FROM Question q WHERE ${whereClause}`,
    params
  );

  const totalQuestions = total;
  const totalPages     = Math.max(1, Math.ceil(totalQuestions / pageSize));

  // Clamp page to valid range
  let page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  if (page > totalPages) page = totalPages;

  const offset = (page - 1) * pageSize;

  // Fetch paginated questions
  const [questions] = await req.db.query(
    `SELECT q.ID,
            q.TYPE,
            q.SECTION,
            q.CATEGORY,
            q.SUBCATEGORY,
            q.POINTS_POSSIBLE,
            q.QUESTION_TEXT,
            q.OWNER_ID
     FROM Question q
     WHERE ${whereClause}
     ORDER BY q.SUBCATEGORY ASC, q.ID ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  // Pair every question on this page with its answers
  // Batch query rather than iterating getAnswersForQuestion()
  let questionsBySubcategory = {};

  if (questions.length > 0)
  {
    const questionIds = questions.map(q => q.ID);
    const [answers]   = await req.db.query(
      `SELECT * FROM AnswerText WHERE QUESTION_ID IN (?)`,
      [questionIds]
    );

    // Get answers
    const answersByQuestionId = {};
    for (const answer of answers)
    {
      if (!answersByQuestionId[answer.QUESTION_ID])
      {
        answersByQuestionId[answer.QUESTION_ID] = [];
      }
      answersByQuestionId[answer.QUESTION_ID].push(answer);
    }

    // Group questions by subcategory, attach answers to each
    for (const question of questions)
    {
      // Prevent database inconsistencies from breaking logic
      const sub = normalizeDBString(question.SUBCATEGORY ?? 'Unknown');
      if (!questionsBySubcategory[sub])
      {
        questionsBySubcategory[sub] = [];
      }
      questionsBySubcategory[sub].push({
        ...question,
        answers: answersByQuestionId[question.ID] ?? [],
      });
    }
  }

  return res.status(200).json({
    questions: questionsBySubcategory,
    pagination: {
      page,
      pageSize,
      totalQuestions,
      totalPages,
    },
  });
}));

module.exports = router;