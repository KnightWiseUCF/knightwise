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
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Helper function, gets answers for a given question
 * @param {number} questionId - Question ID
 * @param {Object} db - Database connection pool
 * @returns {Promise<Array>} Array of answers
 */
const getAnswersForQuestion = async (questionId, db) => {
  const [answers] = await db.query(
    'SELECT * FROM AnswerText WHERE QUESTION_ID = ?',
    [questionId]
  );
  return answers;
};

// GET request to fetch a problem by its ID
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Find question by ID
    const [questions] = await req.db.query(
      'SELECT * FROM Question WHERE ID = ?',
      [id]
    );

    if (questions.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const question = questions[0];

    // Get answers for question
    const answers = await getAnswersForQuestion(id, req.db);

    res.json({...question, answers});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;