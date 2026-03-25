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
//                 guildConfig
//
////////////////////////////////////////////////////////////////

const { EXP_PER_POINT, COINS_PER_POINT, DAILY_EXP_CAP } = require('../../shared/currencyConfig');
const { GUILD_EXP_CONTRIBUTION_RATIO } = require('../../shared/guildConfig')

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

/**
 * Awards ambient exp to a user's guild if they are a member of one
 * Contributes GUILD_EXP_CONTRIBUTION_RATIO of earned exp to the guild's
 * DAILY_EXP, WEEKLY_EXP, and LIFETIME_EXP banks
 * Does NOT decrement from the user's own exp
 * No-ops if the user is not in a guild
 *
 * @param {Object} db           - Database connection pool
 * @param {number} userId       - ID of the user who earned exp
 * @param {number} pointsEarned - Points earned from the submission
 */
const awardGuildExp = async (db, userId, pointsEarned) => {
  // Check if user is in a guild
  const [[membership]] = await db.query(
    'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
    [userId]
  );
  if (!membership) return; // No-op

  const expEarned    = pointsEarned * EXP_PER_POINT;
  const guildExpGain = expEarned * GUILD_EXP_CONTRIBUTION_RATIO;

  // If user got no exp from their question
  if (guildExpGain <= 0) return;

  await db.query(
    `UPDATE Guild SET
      DAILY_EXP    = DAILY_EXP    + ?,
      WEEKLY_EXP   = WEEKLY_EXP   + ?,
      LIFETIME_EXP = LIFETIME_EXP + ?
     WHERE ID = ?`,
    [guildExpGain, guildExpGain, guildExpGain, membership.GUILD_ID]
  );
};

module.exports = {
  awardCurrency,
  awardGuildExp,
}
