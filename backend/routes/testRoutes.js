////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          testRoutes.js
//  Description:   Routes for mock test generation, topic
//                 practice, and answer submission.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//                 errorHandler
//                 gradingController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { gradeQuestion } = require("../controllers/gradingController");

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
 * Helper function, serializes user response into JSON
 * JSON structure depends on question type 
 * Stored in Response.USER_ANSWER and used in History Table
 *
 * @param {string} questionType - Question.TYPE field from database
 * @param {*}      userAnswer   - Raw answer sent by the client
 * @returns {string} JSON containing relevant user response data
 */
const serializeUserAnswer = (questionType, userAnswer) => {

  // Note that there's no case for Programming questions.
  // This is because those take a different path
  // through the code controller and /submitCode!
  switch (questionType) 
  {
    case 'Multiple Choice':
      // Text of the single selected answer choice
      return JSON.stringify({ type: 'MultipleChoice', selected: userAnswer });

    case 'Fill in the Blanks':
      // Text of the user-inputted response
      return JSON.stringify({ type: 'FillInTheBlanks', entered: userAnswer });

    case 'Select All That Apply':
      // Array of selected answer choice texts
      return JSON.stringify({ type: 'SelectAllThatApply', selected: userAnswer });

    case 'Ranked Choice':
      // Ordered array of answer choice texts
      return JSON.stringify({ type: 'RankedChoice', order: userAnswer });

    case 'Drag and Drop':
      // Mappings from placement zones to answer choice texts
      // e.g. { "zone1": "answer A", "zone2": "answer B" }
      return JSON.stringify({ type: 'DragAndDrop', placements: userAnswer });

    default:
      // Should never happen, but just store raw answer so we don't lose info
      return JSON.stringify({ type: questionType, raw: userAnswer });
  }
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
 * @desc    Submit user answer. Note that Question.SUBCATEGORY is stored as Response.TOPIC
 *          Serializes user response data as JSON, stores in Response.USER_ANSWER
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/submit", authMiddleware, asyncHandler(async (req, res) => {
  const { problem_id, userAnswer, category, topic } = req.body;
  const user_id = req.user.id;

  // Get question by ID, we care about question type and points
  const [questions] = await req.db.query(
    'SELECT TYPE, POINTS_POSSIBLE FROM Question WHERE ID = ?',
    [problem_id]
  );
  if (!questions || questions.length === 0)
  {
    throw new AppError(`Question ID not found: ${problem_id}`, 404, 'Question not found.');
  }

  // Deconstruct and extract type and points
  const { TYPE: questionType, POINTS_POSSIBLE: maxPoints } = questions[0];

  // Get answers for this question ID
  const [answers] = await req.db.query(
    'SELECT * FROM AnswerText WHERE QUESTION_ID = ?',
    [problem_id]
  );

  // Grade user response
  const result = gradeQuestion(problem_id, questionType, userAnswer, answers, maxPoints);

  // Serialize response data into JSON
  const serializedAnswer = serializeUserAnswer(questionType, userAnswer);

  // Store user response
  await req.db.query(
    `INSERT INTO Response 
    (
      USERID,
      PROBLEM_ID,
      USER_ANSWER,
      ISCORRECT,
      POINTS_EARNED,
      POINTS_POSSIBLE,
      CATEGORY,
      TOPIC,
      DATETIME
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      problem_id,
      serializedAnswer,
      result.isCorrect,
      result.pointsEarned,
      result.pointsPossible,
      category,
      topic,
      new Date()
    ]
  );

  res.status(201).json(
  { 
    message:          "Answer submitted",
    isCorrect:        result.isCorrect,
    pointsEarned:     result.pointsEarned,
    pointsPossible:   result.pointsPossible,
    normalizedScore:  result.normalizedScore,
    feedback:         result.feedback
  });
}));

module.exports = router;