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
//                validationUtils
//
////////////////////////////////////////////////////////////////

const { notifyUserEvent } = require('../services/discordWebhook');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { parseUserId, validateName } = require('../utils/validationUtils');

/**
 * Helper function, asserts that requesting user matches target user ID
 * Ensures that users can't initiate operations on other users
 * 
 * Note: May want to move this to a new authUtils.js if another file needs this.
 *
 * @param {Object} reqUser  - The authenticated user from req.user
 * @param {number} userId   - The target user ID from the route parameter
 * @param {string} context  - Caller name for error logging (e.g. 'updateUser')
 * @throws {AppError} 403   - If requesting user is not the target user
 */
const assertUserOwnership = (reqUser, userId, context) => {
  if (reqUser.id !== userId) 
  {
    throw new AppError(`[${context}] Unauthorized access: User ${reqUser.id} tried to act on user ${userId}`, 403, "Forbidden");
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user profile
 * @access  Protected
 * 
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Throwable by parseUserId
 * @throws  {AppError} 403                  - Throwable by assertUserOwnership
 * @throws  {AppError} 404                  - If user not found
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming successful deletion
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const context = 'deleteAccount';
  const userId = parseUserId(req.params.id, context);

  // Account can only be deleted by account owner
  assertUserOwnership(req.user, userId, context);

  // Get user info
  const [users] = await req.db.query(
    'SELECT EMAIL, USERNAME FROM User WHERE ID = ?',
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

/**
 * @route   GET /api/users/:id
 * @desc    Retrieve user profile info (profile picture, etc.)
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Throwable by parseUserId
 * @throws  {AppError} 404                  - If user not found
 * @returns {Promise<void>}                 - Sends HTTP/JSON response with user data
 */
const getUserInfo = asyncHandler(async (req, res) => {
  const context = 'getUserInfo';
  const userId = parseUserId(req.params.id, context);

  // Get user info (including user currency info), and equips
  const [[users], [equippedItems]] = await Promise.all([
    req.db.query( // Get user info w/ currency info from User table
      'SELECT ID, USERNAME, LIFETIME_EXP, WEEKLY_EXP, COINS FROM User WHERE ID = ?',
      [userId]
    ),
    req.db.query( // Get equip info from StoreItem/Purchase tables
      `SELECT si.ID, si.TYPE, si.COST, si.NAME
      FROM Purchase p
      JOIN StoreItem si ON si.ID = p.ITEM_ID
      WHERE p.USER_ID = ? AND p.IS_EQUIPPED = true`,
      [userId]
    )
  ]);
  if (users.length === 0)
  {
    throw new AppError(`Failed to get user info, ID not found: ${userId}`, 404, 'User not found');
  }

  // Return the info
  return res
    .status(200)
    .json(
      {
        user: users[0],
        equippedItems
      }
    );
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile editable fields like first name, last name
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - If name validation fails, throwable by parseUserId
 * @throws  {AppError} 403                  - Throwable by assertUserOwnership
 * @throws  {AppError} 404                  - If user not found
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming successful update
 */
const updateUser = asyncHandler(async (req, res) => {
  const context = 'updateUser';
  const userId = parseUserId(req.params.id, context);

  // Profile can only be updated by account owner
  assertUserOwnership(req.user, userId, context);

  const { newFirstName, newLastName } = req.body;

  // Validate new names
  const firstNameError = validateName(newFirstName);
  const lastNameError  = validateName(newLastName);
  if (firstNameError || lastNameError)
  {
    throw new AppError(`Invalid new name: ${newFirstName} ${newLastName}`, 400, firstNameError ?? lastNameError);
  }

  // Save old names for logging
  const [users] = await req.db.query(
    'SELECT FIRSTNAME, LASTNAME FROM User WHERE ID = ?',
    [userId]
  );
  if (users.length === 0) 
  {
    throw new AppError(`Failed to update user, ID not found: ${userId}`, 404, 'User not found');
  }
  const { FIRSTNAME: oldFirstName, LASTNAME: oldLastName } = users[0];

  // Set new names
  await req.db.query(
    'UPDATE User SET FIRSTNAME = ?, LASTNAME = ? WHERE ID = ?',
    [newFirstName, newLastName, userId]
  );

  // Log name change to Discord for moderation
  notifyUserEvent(`User ${userId} changed name from ${oldFirstName} ${oldLastName} to ${newFirstName} ${newLastName}`);

  // Success!
  return res
    .status(200)
    .json({ message: "User info updated successfully" });
});

module.exports = {
  deleteAccount,
  getUserInfo,
  updateUser,
};