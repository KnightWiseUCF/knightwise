////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          userController.js
//  Description:   Controller functions for user operations,
//                 including updating profile information and
//                 deleting accounts. Requires authentication.
//
//  Dependencies: mysql2 connection pool (req.db)
//                discordWebhook
//                errorHandler
//
////////////////////////////////////////////////////////////////

const { notifyUserEvent } = require('../services/discordWebhook');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user profile
 * @access  Protected
 * 
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @returns {Promise<void>}                 - Sends HTTP/JSON response
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Ensure userId is a valid primary key
  if (isNaN(parseInt(userId)) || parseInt(userId) <= 0)
  {
    throw new AppError(`Failed to delete user, userId not a valid primary key: ${userId}`, 400, "Invalid user ID");
  }

  // Account can only be deleted by account owner
  if (req.user.id !== parseInt(userId)) 
  {
    throw new AppError(`Unauthorized delete attempt: userId ${userId} by user ${req.user.id}`, 403, "Forbidden");
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

  // Send delete notification to Discord
  notifyUserEvent(`User deleted: ${user.USERNAME}`);

  return res
    .status(200)
    .json({ message: "Account deleted successfully" });
});

/** TODO
 * @route   GET /api/users/:id
 * @desc    Retrieve user profile (profile picture, etc.)
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @returns {Promise<void>}                 - Sends HTTP/JSON response
 */
const getUserInfo = asyncHandler(async (req, res) => {
  // TODO: Implement fetching user data
});

/** TODO
 * @route   PUT /api/users/:id
 * @desc    Update user profile (profile picture, etc.)
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @returns {Promise<void>}                 - Sends HTTP/JSON response
 */
const updateUser = asyncHandler(async (req, res) => {
  // TODO: Implement updating user data
});

// TODO: Export getUserInfo and updateUser when implemented
module.exports = {
  deleteAccount
};