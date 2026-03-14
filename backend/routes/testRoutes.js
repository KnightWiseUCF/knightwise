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
//                 currencyUtils
//                 codeLimits (daily submission check)
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { gradeQuestion } = require("../controllers/gradingController");
const { awardCurrency } = require("../utils/currencyUtils");
const { getProgrammingSubmissionsRemaining } = require("../config/codeLimits");

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
 * @desc    Fetch published questions for a given subcategory (e.g. Backtracking)
 *          Maximum of 1 programming question, or 0
 *          if user has reached the max daily submission
 *          limit for programming questions.
 *          WARNING: THIS ENDPOINT IS INTENDED ONLY FOR GENERATING TOPIC PRACTICE SESSIONS.
 *          Programming questions may be silently filtered out based on the requesting
 *          user's daily submission limit. Using this endpoint as a general question
 *          enumerator may return incomplete results.
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with the subcategory's published questions and answers
 */
router.get("/topic/:topicName", authMiddleware, asyncHandler(async (req, res) => {
  const { topicName } = req.params;

  // Get all questions of this subcategory
  const [questions] = await req.db.query(
    'SELECT * FROM Question WHERE SUBCATEGORY = ? AND IS_PUBLISHED = 1',
    [topicName]
  );

  if (!questions || questions.length === 0) 
  {
    throw new AppError(`No published questions exist for subcategory: ${topicName}`, 404, "Question not found");
  }

  // If user reached programming question daily submission limit,
  // filter out programming questions
  // Otherwise only allow one programming question to be included
  const remaining = await getProgrammingSubmissionsRemaining(req.db, req.user.id);
  let programmingQuestionUsed = false;
  const filtered = questions.filter(q => {
    if (q.TYPE !== 'Programming') return true;
    if ( !(remaining > 0) || programmingQuestionUsed) return false;
    programmingQuestionUsed = true;
    return true;
  });

  const questionsWithAnswers = await pairAnswersWithQuestions(filtered, req.db);
  res.json(questionsWithAnswers);
}));

/**
 * @route   GET /api/test/mocktest
 * @desc    Fetch questions info for a mock test
 *          Maximum of 1 programming question, or 0
 *          if user has reached the max daily submission
 *          limit for programming questions.
 * @access  Protected
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with mock test info
 */
router.get("/mocktest", authMiddleware, asyncHandler(async (req, res) => {
  const sections = ["A", "B", "C", "D"];
  const questionsBySection = {};

  // Check if user has reached the daily limit for programming questions
  const remaining = await getProgrammingSubmissionsRemaining(req.db, req.user.id);

  // shuffled problem per section and pick three published questions randomly
  let programmingQuestionUsed = false;
  for (const section of sections) {
    // Don't include programming in the query if:
    // - User is at daily submission limit
    // - We've already included one programming question
    const excludeProgramming = !(remaining > 0) || programmingQuestionUsed;
    const [questions] = await req.db.query(
      `SELECT * FROM Question WHERE SECTION = ? AND IS_PUBLISHED = 1
      ${excludeProgramming ? "AND TYPE != 'Programming'" : ""}`,
      [section]
    );

    if (!questions || questions.length === 0) 
    {
      throw new AppError(`Published question not found in section: ${section}`, 404, "Question not found");
    }
    const shuffled = questions.sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3);
    questionsBySection[section] = picked;

    // We included a programming question, so don't include any additional
    if (!programmingQuestionUsed && picked.some(q => q.TYPE === 'Programming')) 
    {
      programmingQuestionUsed = true;
    }
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

  // Award currency to user (respects daily exp cap)
  await awardCurrency(req.db, user_id, result.pointsEarned);

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