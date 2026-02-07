////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Mina G.
//  File:          adminRoutes.js
//  Description:   Admin routes for TODO
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 otp-generator
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const adminMiddleware = require("../middleware/adminMiddleware");

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
 * @route   DELETE /api/admin/user/:id
 * @desc    Delete a user's account and associated data
 * @access  Admin
 */
router.delete("/users/:id", adminMiddleware, asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Ensure userId is a valid primary key
  if (isNaN(parseInt(userId)) || parseInt(userId) <= 0)
  {
    throw new AppError(`Failed to delete user, userId not a valid primary key: ${userId}`, 400, "Invalid user ID");
  }

  // Get user info
  const [users] = await req.db.query(
    'SELECT * FROM User WHERE ID = ?',
    [userId]
  );

  if (users.length === 0)
  { 
    throw new AppError(`Failed to delete user, userId not found: ${userId}`, 404, "User not found");
  }

  const user = users[0];

  // Delete user and associated email code/answers
  await req.db.query('DELETE FROM User WHERE ID = ?', [userId]);
  await req.db.query('DELETE FROM EmailCode WHERE EMAIL = ?', [user.EMAIL]);
  await req.db.query('DELETE FROM Response WHERE USERID = ?', [userId]);
  console.log(`User ${userId} and all associated data deleted successfully`);

  return res
    .status(200)
    .json({ message: "Account deleted successfully" });
}));


/**
 * @route   DELETE /api/admin/problems/:id
 * @desc    Delete a question and associated data
 * @access  Admin
 */
router.delete("/problems/:id", adminMiddleware, asyncHandler(async (req, res) => {
  const questionId = req.params.id;

  // Ensure userId is a valid primary key
  if (isNaN(parseInt(questionId)) || parseInt(questionId) <= 0)
  {
    throw new AppError(`Failed to delete question, questionId not a valid primary key: ${questionId}`, 400, "Invalid question ID");
  }

  // Get user info
  const [questions] = await req.db.query(
    'SELECT * FROM Question WHERE ID = ?',
    [questionId]
  );

  if (questions.length === 0)
  { 
    throw new AppError(`Failed to delete question, questionId not found: ${questionId}`, 404, "Question not found");
  }

  const question = questions[0];

  // Delete user and associated email code/answers
  await req.db.query('DELETE FROM Question WHERE ID = ?', [questionId]);
  await req.db.query('DELETE FROM AnswerText WHERE QUESTION_ID = ?', [questionId]);
  await req.db.query('DELETE FROM Response WHERE PROBLEM_ID = ?', [questionId]);
  console.log(`Question ${questionId} and all associated data deleted successfully`);

  return res
    .status(200)
    .json({ message: "Question deleted successfully" });
}));


/**
 * @route   POST /api/admin/createuser
 * @desc    Allows an admin to create an accout bypassing verification
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/createuser", adminMiddleware, asyncHandler(async(req, res) => {
  const { username, email, password, firstName, lastName } = req.body;
  
  if (!username || !email || !password || !firstName || !lastName) 
  {
    throw new AppError("Missing required fields", 400, "Invalid fields");
  }
  
  // Check if user already exists
  const [existingUsers] = await req.db.query(
    'SELECT * FROM User WHERE USERNAME = ?', 
    [username]
  );

  if (existingUsers.length > 0)
  {
    throw new AppError(`User "${username}" or email "${email}" already exists`, 400, "User or email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert new user into db
  const [result] = await req.db.query(
    'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashedPassword, firstName, lastName]
  );

  const userId = result.insertId;

  res.status(201).json({ message: "User Registered", userId});

}));
module.exports = router;

/**
 * @route   POST /api/admin/createquestion
 * @desc    Create a new question object and a certain number of corresponding answer_text objects
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/createquestion", adminMiddleware, asyncHandler(async (req, res) => {
  const { type, author_exam_id, section, category, subcategory, points_possible, question_text, owner_id, answer_text, answer_correctness, answer_priority } = req.body;

  if (!type || !author_exam_id || !section || !category || !subcategory || !points_possible || !question_text || !answer_text || !answer_correctness || !answer_priority)
  {
    throw new AppError("Missing required fields", 400, "Invalid fields");
  }

  const [result] = await req.db.query(
    'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [type, author_exam_id, section, category, subcategory, points_possible, question_text, owner_id]
  );

  const questionId = result.insertId;

  if (questionId)
  {
    for (let i = 0; i < answer_text.length; i++)
    {
      await req.db.query(
        'INSERT INTO AnswerText (QUESTION_ID, IS_CORRECT_ANSWER, TEXT, PRIORITY) VALUES (?, ?, ?, ?)',
        [questionId, answer_correctness[i], answer_text[i], answer_priority[i]]
      );
    }
  }

  res.status(201).json({ message: "Question added", questionId});
}));

/**
 * @route   GET /api/admin/problems/:id
 * @desc    Fetch a question by its ID with its associated answers
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with question and its answers
 */
router.get('/problems/:id', adminMiddleware, asyncHandler(async (req, res) => {
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

/**
 * @route   GET /api/admin/getuser
 * @desc    Fetch a user by its ID or username
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with question and its answers
 */
router.get('/getuser', adminMiddleware, asyncHandler(async (req, res) => {
  const { id, username } = req.body;

  // Find user by ID
  if (username == null)
  {
  const [users] = await req.db.query(
    'SELECT * FROM User WHERE ID = ?',
    [id]
  );

  if (users.length === 0) 
  {
    throw new AppError(`No users associated with ID: ${id}`, 404, "User not found");
  }
  
  const user = users[0];


  res.json({...user});
  }

  // find user by username
  else if (id == null)
  {
  const [users] = await req.db.query(
    'SELECT * FROM User WHERE USERNAME = ?',
    [username]
  );

  if (users.length === 0) 
  {
    throw new AppError(`No users associated with username: ${username}`, 404, "User not found");
  }

  const user = users[0];


  res.json({...user});
  }

  
}));

/**
 * @route   GET /api/admin/unverifiedprofs
 * @desc    Fetch a list of unverified professors
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with question and its answers
 */
router.get('/unverifiedprofs', adminMiddleware, asyncHandler(async (req, res) => {
  
  const [profs] = await req.db.query(
    'SELECT * FROM Professor WHERE VERIFIED = 0'
  );

  res.json({...profs});
  
}));

/**
 * @route   POST /api/admin/verifyprof/:id
 * @desc    Verify a professor by ID
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with professor verification status message
 */
router.post('/verifyprof/:id', adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Ensure id is a valid primary key
  if (isNaN(parseInt(id)) || parseInt(id) <= 0)
  {
    throw new AppError(`Failed to verify professor, id not a valid primary key: ${id}`, 400, "Invalid professor ID");
  }

  const [profs] = await req.db.query(
    'UPDATE Professor SET VERIFIED = 1 WHERE ID = ?',
    [id]
  );

  res.json({ message: "Professor verified successfully" });
  
}));

module.exports = router;