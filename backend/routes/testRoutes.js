////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          test.js
//  Description:   Routes for mock test generation, topic
//                 practice, and answer submission.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

/**
 * Helper function, gets answers for given questions, pairs them with each question
 * @param {Array}  questions - Array of question objects with ID field
 * @param {Object} db        - Database connection pool
 * @returns {Promise<Array>} - Questions with paired answers array
 */
const pairAnswersWithQuestions = async (questions, db) => {
  if (!questions || questions.length === 0) 
  {
    return questions;
  }

  const questionIds = questions.map(q => q.ID);
  const [answers] = await db.query(
    'SELECT * FROM AnswerText WHERE QUESTION_ID IN (?)',
    [questionIds]
  );

  return questions.map(question => ({
    ...question,
    answers: answers.filter(answer => answer.QUESTION_ID === question.ID)
  }));
};

/**
 * @route   GET /api/test/topic/:topicName
 * @desc    Fetch questions for a given subcategory (e.g. Backtracking)
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with the subcategory's questions and answers
 */
router.get("/topic/:topicName", authMiddleware, asyncHandler(async (req, res) => {
  const { topicName } = req.params;

  // Get all questions of this subcategory
  const [questions] = await req.db.query(
    'SELECT * FROM Question WHERE SUBCATEGORY = ?',
    [topicName]
  );

  if (!questions || questions.length === 0) 
  {
    throw new AppError(`No questions exist for subcategory: ${topicName}`, 404, "Question not found");
  }

  const questionsWithAnswers = await pairAnswersWithQuestions(questions, req.db);
  res.json(questionsWithAnswers);
}));

/**
 * @route   GET /api/test/mocktest
 * @desc    Fetch questions info for a mock test
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with mock test info
 */
router.get("/mocktest", authMiddleware, asyncHandler(async (req, res) => {
  const sections = ["A", "B", "C", "D"];
  const questionsBySection = {};

  // shuffled problem per section and pick three question randomly
  for (const section of sections) {
    const [questions] = await req.db.query(
      'SELECT * FROM Question WHERE SECTION = ?',
      [section]
    );

    if (!questions || questions.length === 0) 
    {
      throw new AppError(`Question not found in section: ${section}`, 404, "Question not found");
    }
    const shuffled = questions.sort(() => 0.5 - Math.random());
    questionsBySection[section] = shuffled.slice(0, 3);
  }

  const allQuestions = Object.values(questionsBySection).flat();
  const questionsWithAnswers = await pairAnswersWithQuestions(allQuestions, req.db);

  res.status(200).json({ total: questionsWithAnswers.length, questions: questionsWithAnswers });
}));

/**
 * @route   POST /api/test/submit
 * @desc    Submit user answer. Note that 'SUBCATEGORY' from Question table is stored as 'TOPIC' in Response table
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/submit", authMiddleware, asyncHandler(async (req, res) => {
  const { problem_id, isCorrect, category, topic } = req.body;
  const user_id = req.user.id;

  await req.db.query(
    'INSERT INTO Response (USERID, PROBLEM_ID, ISCORRECT, CATEGORY, TOPIC, DATETIME) VALUES (?, ?, ?, ?, ?, ?)',
    [user_id, problem_id, isCorrect, category, topic, new Date()]
  );

  res.status(201).json({ message: "Answer submitted" });
}));

module.exports = router;