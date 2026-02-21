////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Mina G., Daniel Landsman
//  File:          adminRoutes.js
//  Description:   Admin routes for privileged operations
//                 executed by the Discord admin bot.
//                 
//                 Note that some operations are shared
//                 with verified professors, but have 
//                 different authorization flows.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 otp-generator
//                 errorHandler
//                 authMiddleware
//                 requireRole
//                 node-mailjet
//                 discordWebhook service (notifyUserEvent)
//
////////////////////////////////////////////////////////////////

const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const adminMiddleware = require("../middleware/adminMiddleware");
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { notifyUserEvent } = require("../services/discordWebhook");

// Mailjet for sending professor verified email
const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

/**
 * Helper middleware for endpoints shared between admins and professors
 * Routes admin requests (requests with ADMIN_KEY) through adminMiddleware
 * Routes professor requests (requests without ADMIN_KEY) through authMiddleware
 * Enforces role to ensure only admins and professors get intended access
 * @type {import('express').RequestHandler[]}
 */
const adminOrProf = [
  (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]?.trim();
    token === process.env.ADMIN_KEY
      ? adminMiddleware(req, res, next)
      : authMiddleware(req, res, next);
  },
  requireRole('admin', 'professor')
];

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
 * Helper function, sends verification approval email to newly-verified professor
 * Surround with try-catch in case of failure
 * @param {Object} prof           - Professor object from Professor db table
 * @param {string} prof.EMAIL     - Professor email address
 * @param {string} prof.FIRSTNAME - Professor first name
 * @param {string} prof.LASTNAME  - Professor last name
 * @returns {Promise<void>}
 */
const sendProfVerifiedEmail = async (prof) => {
  await mailjet
    .post('send', { version: 'v3.1' })
    .request({
      Messages: 
      [{
        From: 
        {
          Email: "webdevpeeps@gmail.com",
          Name: "KnightWise"
        },
        To: 
        [{
          Email: prof.EMAIL,
          Name: `${prof.FIRSTNAME} ${prof.LASTNAME}`
        }],
        Subject: "Your KnightWise professor account has been verified!",
        TextPart: `Hi Professor ${prof.LASTNAME}, your KnightWise professor account has been verified. You can now log in at https://www.knightwise.dev. Thanks for joining KnightWise!`,
        HTMLPart: 
          `<html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>KnightWise Professor Account Verified</title>
          </head>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <div style="background-color: #ba9b37; padding: 24px; text-align: center;">
                <h1 style="font-size: 28px; color: white; margin: 0;">Account Verified!</h1>
              </div>
              <div style="padding: 32px;">
                <p style="color: #374151; font-size: 16px;">Hello ${prof.FIRSTNAME},</p>
                <p style="color: #374151; font-size: 16px;">
                  Your KnightWise professor account has been verified by an administrator. You can now log in and start contributing questions.
                </p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                  <a href="https://knightwise.com/login" style="font-size: 18px; color: #ba9b37; font-weight: bold; text-decoration: none;">Log in to KnightWise</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">If you did not create this account, please contact us immediately.</p>
                <p style="color: #6b7280; font-size: 14px;">Thank you for joining KnightWise!</p>
              </div>
            </div>
          </body>
          </html>`
      }]
    });
}

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

/**
 * @route   POST /api/admin/createquestion
 * @desc    Create a new question object and a certain number of corresponding answer_text objects
 * @access  Admin, Professor
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/createquestion", adminOrProf, asyncHandler(async (req, res) => {
  const { type, author_exam_id, section, category, subcategory, points_possible, question_text, owner_id, answer_text, answer_correctness, answer_rank, answer_placement } = req.body;

  if (!type || !author_exam_id || !section || !category || !subcategory || !points_possible || !question_text || !answer_text || !answer_correctness || !answer_rank || !answer_placement)
  {
    throw new AppError("Missing required fields", 400, "Invalid fields");
  }

  if (!(answer_correctness.length === answer_rank.length && answer_correctness.length === answer_text.length && answer_correctness.length === answer_placement.length))
  {
    throw new AppError("Answer arrays are not equal length.", 400, "Invalid fields");
  }

  // Guard: Professors can only add questions under their own ID
  // If role is professor, their owner ID is forced to be their own ID,
  // eliminates risk of spoofing/passing in inappropriate ID.
  // If role is admin, using the passed in ID is okay 
  // (or their own ID if what they passed in is undefined)
  const effectiveOwnerId = req.user?.role === 'professor'
    ? req.user.id
    : (owner_id ?? req.user?.id);

  const [result] = await req.db.query(
    'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [type, author_exam_id, section, category, subcategory, points_possible, question_text, effectiveOwnerId]
  );

  const questionId = result.insertId;

  if (questionId)
  {
    for (let i = 0; i < answer_text.length; i++)
    {
      await req.db.query(
        'INSERT INTO AnswerText (QUESTION_ID, IS_CORRECT_ANSWER, `TEXT`, `RANK`, PLACEMENT) VALUES (?, ?, ?, ?, ?)',
        [questionId, answer_correctness[i], answer_text[i], answer_rank[i], answer_placement[i]]
      );
    }
  }

  // Notify webhook that question was created
  notifyUserEvent(`New question created: ID ${questionId} by ${req.user?.role} (owner ID: ${effectiveOwnerId})`);

  res.status(201).json({ message: "Question added", questionId});
}));

/**
 * @route   GET /api/admin/problems/:id
 * @desc    Fetch a question by its ID with its associated answers
 * @access  Admin, Professor
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with question and its answers
 */
router.get('/problems/:id', adminOrProf, asyncHandler(async (req, res) => {
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
  const { id, username } = req.query;

  // Ensure only one of ID or username is provided, not both and not neither
  if ((id && username) || !(id || username))
  {
    throw new AppError('Bad /getuser request, provide username OR id', 400, 'Bad /getuser request.')
  }

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

  res.json({profs});
  
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
    'SELECT * FROM Professor WHERE ID = ?',
    [id]
  );
  if (!profs || profs.length === 0)
  {
    throw new AppError(`Failed to verify professor, ID not found: ${id}`, 404, 'Professor not found.');
  }
  const prof = profs[0];

  await req.db.query(
    'UPDATE Professor SET VERIFIED = 1 WHERE ID = ?',
    [id]
  );

  // Send email to professor letting them know they were verified
  try
  {
    await sendProfVerifiedEmail(prof);
  }
  catch (emailErr)
  {
    console.error(`Failed to send professor verified email to ${prof.EMAIL}: ${emailErr.message}`);
  }

  res.json({ message: "Professor verified successfully" });
  
}));

module.exports = router;
