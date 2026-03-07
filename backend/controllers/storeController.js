////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          storeController.js
//  Description:   Controller functions for store operations,
//                 including fetching/purchasing store items. 
//                 Requires authentication.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 errorHandler
//                 validationUtils
//
////////////////////////////////////////////////////////////////

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { parseUserId }            = require('../utils/validationUtils');

/**
 * @route   GET /api/store
 * @desc    Fetch metadata for all store items
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @returns {Promise<void>}                 - Sends HTTP/JSON response with all store items
 */
const getStoreItems = asyncHandler(async (req, res) => {
  const [items] = await req.db.query(
    'SELECT ID, TYPE, COST, NAME FROM StoreItem'
  );

  return res.status(200).json({ items });
});

/**
 * @route   POST /api/store/:id/purchase
 * @desc    Attempt to purchase a store item with coins
 * @access  Protected
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @throws  {AppError} 400                  - User has insufficient coins, throwable by parseUserId
 * @throws  {AppError} 404                  - If store item not found
 * @throws  {AppError} 409                  - If item already purchased
 * @returns {Promise<void>}                 - Sends HTTP/JSON response confirming successful purchase
 */
const purchaseItem = asyncHandler(async (req, res) => {
  const context = 'purchaseItem';
  const itemId  = parseUserId(req.params.id, context);
  const userId  = req.user.id;

  // Fetch item
  const [items] = await req.db.query(
    'SELECT ID, TYPE, COST, NAME FROM StoreItem WHERE ID = ?',
    [itemId]
  );
  if (items.length === 0)
  {
    throw new AppError(`[${context}] Store item not found: ${itemId}`, 404, 'Item not found');
  }
  const item = items[0];

  // Check if already purchased
  const [existing] = await req.db.query(
    'SELECT 1 FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?',
    [userId, itemId]
  );
  if (existing.length > 0)
  {
    throw new AppError(`[${context}] User ${userId} already owns item ${itemId}`, 409, 'Item already purchased');
  }

  // Check if user can afford item
  const [users] = await req.db.query(
    'SELECT COINS FROM User WHERE ID = ?',
    [userId]
  );
  if (users.length === 0)
  {
    throw new AppError(`[${context}] User not found: ${userId}`, 404, 'User not found');
  }

  const { COINS: currentCoins } = users[0];
  if (currentCoins < item.COST)
  {
    throw new AppError(`[${context}] User ${userId} has insufficient coins: ${currentCoins} < ${item.COST}`, 400, 'Insufficient coins');
  }

  // Deduct coins and insert purchase
  // Done in a transaction so it can't be stopped halfway
  // We need one connection from the pool to do the transaction
  const conn = await req.db.getConnection();
  try
  {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE User SET COINS = COINS - ? WHERE ID = ?',
      [item.COST, userId]
    );
    await conn.query(
      'INSERT INTO Purchase (USER_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
      [userId, itemId]
    );
    await conn.commit();
  }
  catch (err)
  {
    await conn.rollback();
    throw new AppError(`[${context}] Transaction failed for user ${userId} purchasing item ${itemId}: ${err.message}`, 500, 'Purchase failed');
  }
  finally
  {
    conn.release();
  }

  return res.status(200).json({ message: 'Item purchased successfully' });
});

module.exports = {
  getStoreItems,
  purchaseItem,
};