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
//                itemConfig
//
////////////////////////////////////////////////////////////////

const { notifyUserEvent } = require('../services/discordWebhook');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { parseUserId, validateName } = require('../utils/validationUtils');
const { EQUIP_LIMITS } = require('../../shared/itemConfig');

/**
 * Helper function, ensures followee exists 
 * and checks if follower is following followee
 * Used in followUser and unfollowUser
 * 
 * @param   {Object} db         - Database connection pool
 * @param   {Object} followerId - The ID of the follower user
 * @param   {number} followeeId - The ID of the followee user
 * @param   {string} context    - Caller name for error logging (e.g. 'followUser')
 * @throws  {AppError} 404      - If followee ID not found
 * @returns {Promise<boolean>}  - True if follower is currently following followee, else false
 */
const isFollowing = async (db, followerId, followeeId, context) => {
  // Ensure the user we want to (un)follow exists
  const [users] = await db.query(
    'SELECT ID FROM User WHERE ID = ?',
    [followeeId]
  );
  if (users.length === 0)
  {
    throw new AppError(`[${context}] Failed to check follow relationship, followee ID not found: ${followeeId}`, 404, 'User not found');
  }

  // Check if a Follower row exists for the follower-followee relationship
  const [follows] = await db.query(
    'SELECT FOLLOWER_ID FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
    [followerId, followeeId]
  );

  // True if follow relationship found, else false
  return (follows.length !== 0 ? true : false);
};

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
 * Helper function, asserts that user owns the store item
 * Used in equipItem() and unequipItem()
 *
 * @param {Object} db       - Database connection pool
 * @param {number} userId   - The user ID attempting to act on the store item
 * @param {number} itemId   - The store item ID being acted on
 * @param {string} context  - Caller name for error logging (e.g. 'equipItem')
 * @throws {AppError} 404   - If user doesn't own the store item
 * @returns {Promise<{IS_EQUIPPED: boolean, TYPE: string}>} - Purchase row for itemId
 */
const assertItemOwnership = async (db, userId, itemId, context) => {
  const [purchases] = await db.query(
    `SELECT p.IS_EQUIPPED, si.TYPE
     FROM Purchase p
     JOIN StoreItem si ON si.ID = p.ITEM_ID
     WHERE p.USER_ID = ? AND p.ITEM_ID = ?`,
    [userId, itemId]
  );
  if (purchases.length === 0)
  {
    throw new AppError(`[${context}] User ${userId} does not own item ${itemId}`, 404, 'Item not purchased');
  }
  
  return purchases[0];
}

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
      'SELECT ID, USERNAME, FIRSTNAME, LASTNAME, LIFETIME_EXP, WEEKLY_EXP, DAILY_EXP, COINS FROM User WHERE ID = ?',
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

/**
 * @route   GET /api/users/:id/purchases
 * @desc    Fetch a user's purchased store items
 *          Any authenticated user can see any user's purchases
 * @access  Protected
 * 
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Throwable by parseUserId
 * @returns {Promise<void>}                 - Sends HTTP/JSON response with user purchases
 */
const getPurchases = asyncHandler(async (req, res) => {
  const context = 'getPurchases';
  const userId    = parseUserId(req.params.id, context);

  // Get purchased items for user, join with item data
  const [purchases] = await req.db.query(
    `SELECT si.ID, si.TYPE, si.COST, si.NAME, p.IS_EQUIPPED
    FROM Purchase p
    JOIN StoreItem si ON si.ID = p.ITEM_ID
    WHERE p.USER_ID = ?`,
    [userId]
  );

  return res.status(200).json({ purchases });
});

/**
 * @route   PUT /api/users/:id/equip
 * @desc    Equip a purchased store item
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Throwable by parseUserId or if item already equipped
 * @throws  {AppError} 403                  - Throwable by assertUserOwnership
 * @throws  {AppError} 404                  - If purchase not found, throwable by assertItemOwnership
 * @throws  {AppError} 409                  - If equip limit reached for item type
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming equip update
 */
const equipItem = asyncHandler(async (req, res) => {
  const context   = 'equipItem';
  const userId    = parseUserId(req.params.id, context);
  const { itemId } = req.body;

  // Assert that user isn't trying to equip for someone else
  assertUserOwnership(req.user, userId, context);

  // Assert that user owns the item they're trying to equip
  // Get item type of item to equip
  const { TYPE: itemType, IS_EQUIPPED: isEquipped } = await assertItemOwnership(req.db, userId, itemId, context);

  // Make sure user can't double equip
  // Not too consequential since it would just leave equip status unchanged,
  // but if we're ever double-equipping it's worth asking why.
  if (isEquipped)
  {
    throw new AppError(`[${context}] Item ${itemId} is already equipped`, 400, 'Item is already equipped');
  }

  // Check limit for this item type
  const limit = EQUIP_LIMITS[itemType];
  if (limit !== undefined)
  {
    const [equipped] = await req.db.query(
      `SELECT COUNT(*) AS count
        FROM Purchase p
        JOIN StoreItem si ON si.ID = p.ITEM_ID
        WHERE p.USER_ID = ? AND si.TYPE = ? AND p.IS_EQUIPPED = true`,
      [userId, itemType]
    );
    if (equipped[0].count >= limit)
    {
      // If the equip limit is 1 (e.g. profile pictures),
      // don't confuse the user and make them unequip, just swap them out.
      // When a user equips a new profile picture, it's clear they just want to 
      // swap out their current one.
      if (limit === 1)
      {
        // Unequip their currently equipped item
        await req.db.query(
          `UPDATE Purchase p
          JOIN StoreItem si ON si.ID = p.ITEM_ID
          SET p.IS_EQUIPPED = 0
          WHERE p.USER_ID = ? AND si.TYPE = ? AND p.IS_EQUIPPED = true`,
          [userId, itemType]
        );
      }
      else
      {
        throw new AppError(
          `[${context}] User ${userId} has reached equip limit for type ${itemType}`,
          409, // 409 Conflict made sense here
          `Equip limit reached for ${itemType} (max ${limit})`
        );
      }
    }
  }

  // Update equip state
  await req.db.query(
    'UPDATE Purchase SET IS_EQUIPPED = 1 WHERE USER_ID = ? AND ITEM_ID = ?',
    [userId, itemId]
  );

  return res.status(200).json({ message: `Item equipped successfully` });
});

/**
 * @route   PUT /api/users/:id/unequip
 * @desc    Unequip a purchased store item
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Throwable by parseUserId or if item already unequipped
 * @throws  {AppError} 403                  - Throwable by assertUserOwnership
 * @throws  {AppError} 404                  - If purchase not found
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming equip update
 */
const unequipItem = asyncHandler(async (req, res) => {
  const context   = 'unequipItem';
  const userId    = parseUserId(req.params.id, context);
  const { itemId } = req.body;

  // Assert that user isn't trying to unequip for someone else
  assertUserOwnership(req.user, userId, context);

  // Assert that user owns the item they're trying to unequip
  const { IS_EQUIPPED: isEquipped } = await assertItemOwnership(req.db, userId, itemId, context);

  // Again, technically a double-unequip is a harmless no-op,
  // but I'd rather have the app yell at us if we double-unequip, since we shouldn't.
  if (!isEquipped)
  {
    throw new AppError(`[${context}] Item ${itemId} is not equipped`, 400, 'Item is not equipped');
  }

  // Update equip state
  await req.db.query(
    'UPDATE Purchase SET IS_EQUIPPED = 0 WHERE USER_ID = ? AND ITEM_ID = ?',
    [userId, itemId]
  );

  return res.status(200).json({ message: `Item unequipped successfully` });
});

/**
 * @route   POST /api/users/:id/follow
 * @desc    Follow the user with the given ID
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - If followee is already followed, user is trying to follow themselves, or throwable by parseUserId
 * @throws  {AppError} 404                  - Throwable by isFollowing
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming follow
 */
const followUser = asyncHandler(async (req, res) => {
  const context    = 'followUser';
  const followerId = req.user.id;
  const followeeId = parseUserId(req.params.id, context);

  // Ensure user is not trying to follow themselves
  if (followerId === followeeId)
  {
    throw new AppError(`User ${followerId} cannot follow themselves`, 400, 'User cannot follow themselves.');
  }

  // Ensure proposed followee exists and that we _don't_ already follow them
  const alreadyFollowing = await isFollowing(req.db, followerId, followeeId, context);
  if (alreadyFollowing)
  {
    throw new AppError(`User ${followerId} is already following ${followeeId}`, 400, 'User is already followed.');
  }

  // Insert Follower row, creating follower relationship
  // NOTE: This is a one-way relationship, this doesn't
  //       mean that followee follows follower.
  await req.db.query(
    'INSERT INTO Follower (FOLLOWER_ID, FOLLOWING_ID) VALUES (?, ?)',
    [followerId, followeeId]
  );

  return res.status(200).json({ message: 'User followed successfully' });
});

/**
 * @route   DELETE /api/users/:id/follow
 * @desc    Unfollow the user with the given ID
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - Follower is not already following followee, throwable by parseUserId
 * @throws  {AppError} 404                  - Throwable by isFollowing
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming unfollow
 */
const unfollowUser = asyncHandler(async (req, res) => {
  const context = 'unfollowUser';
  const followerId = req.user.id;
  const followeeId = parseUserId(req.params.id, context);
  
  // Ensure proposed followee exists and that we already follow them
  const alreadyFollowing = await isFollowing(req.db, followerId, followeeId, context);
  if (!alreadyFollowing)
  {
    throw new AppError(`User ${followerId} is not following ${followeeId}`, 400, 'User is not followed.');
  }
  
  // Delete Follower row, eliminating follower relationship
  // NOTE: This is a one-way relationship, this doesn't
  //       mean that followee no longer follows follower
  await req.db.query(
    'DELETE FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
    [followerId, followeeId]
  );

  return res.status(200).json({ message: 'User unfollowed successfully' });
});

module.exports = {
  deleteAccount,
  getUserInfo,
  updateUser,
  getPurchases,
  equipItem,
  unequipItem,
  followUser,
  unfollowUser,
};