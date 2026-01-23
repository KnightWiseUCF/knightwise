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
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

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
    'SELECT * FROM Question WHERE ID = ?',
    [id]
  );

  if (questions.length === 0) 
  {
    throw new AppError(`No questions associated with ID: ${id}`, 404, "Question not found");
  }

  const question = questions[0];

  // Get answers for question
  const answers = await getAnswersForQuestion(id, req.db);

  res.json({...question, answers});
}));

module.exports = router;