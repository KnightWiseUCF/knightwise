////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          currencyUtils.js
//  Description:   Utilities and helper functions for
//                 user currency (coins and exp)
//
//  Dependencies:  currencyConfig
//
////////////////////////////////////////////////////////////////

const { EXP_PER_POINT, COINS_PER_POINT, DAILY_EXP_CAP } = require('../../shared/currencyConfig');

/**
 * Awards exp and coins to a user based on points earned
 * Respects daily exp cap (see currencyConfig.js)
 * Used by regular and coding submission endpoints
 * 
 * @param {Object} db           - Database connection pool
 * @param {number} userId       - ID of user to award
 * @param {number} pointsEarned - Points earned from submission
 */
const awardCurrency = async (db, userId, pointsEarned) => {
  // Get user's daily exp
  const [[user]] = await db.query(
    'SELECT DAILY_EXP FROM User WHERE ID = ?',
    [userId]
  );

  // Calculate currency to award
  const expEarned   = pointsEarned * EXP_PER_POINT;
  const coinsEarned = pointsEarned * COINS_PER_POINT;

  // Take min(earned exp, exp until cap) to respect cap
  const expToAward = Math.min(expEarned, Math.max(0, DAILY_EXP_CAP - user.DAILY_EXP));

  // Award currency
  if (expToAward > 0 || coinsEarned > 0)
  {
    await db.query(
      `UPDATE User SET
        WEEKLY_EXP       = WEEKLY_EXP + ?,
        LIFETIME_EXP     = LIFETIME_EXP + ?,
        DAILY_EXP        = DAILY_EXP + ?,
        COINS            = COINS + ?
      WHERE ID = ?`,
      [expToAward, expToAward, expToAward, coinsEarned, userId]
    );
  }
};

module.exports = {
  awardCurrency,
}
