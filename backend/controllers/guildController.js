////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildController.js
//  Description:   Controller functions for guild operations.
//                 Requires authentication.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 errorHandler
//                 guildNames
//                 itemConfig
//                 guildConfig
//                 discordWebhook
//                 jsonwebtoken
//
////////////////////////////////////////////////////////////////

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const guildNames = require('../config/guildNames');
const { EQUIP_LIMITS } = require('../../shared/itemConfig');
const { MAX_GUILD_SIZE } = require('../../shared/guildConfig');
const { notifyUserEvent } = require('../services/discordWebhook');
const jwt = require('jsonwebtoken');

/**
 * Helper function, asserts that the requesting user is a member of the guild
 * and that their role is one of the allowed roles.
 * Used throughout the file to enforce guild role permissions
 *
 * @param {Object}    db           - Database connection pool
 * @param {number}    userId       - Requesting user's ID
 * @param {number}    guildId      - Guild ID
 * @param {string[]}  allowedRoles - Roles permitted to perform the action
 * @param {string}    context      - Caller name for error logging
 * @throws {AppError} 403          - If user is not a member or role not permitted
 * @returns {Promise<string>}      - The caller's guild role
 */
const assertGuildRole = async (db, userId, guildId, allowedRoles, context) => {
  const [[member]] = await db.query(
    'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [userId, guildId]
  );

  if (!member)
  {
    throw new AppError(`[${context}] User ${userId} is not a member of guild ${guildId}`, 403, 'Forbidden');
  }

  if (!allowedRoles.includes(member.ROLE))
  {
    throw new AppError(`[${context}] Role ${member.ROLE} not permitted for this action`, 403, 'Forbidden');
  }

  return member.ROLE;
};

/**
 * Helper function, verifies a guild item has been unlocked by the guild
 * (guild coin bank has met the item's cost threshold and
 * a GuildUnlock row exists). Analogous to assertItemOwnership.
 *
 * @param {Object}  db      - Database connection pool
 * @param {number}  guildId - Guild ID
 * @param {number}  itemId  - StoreItem ID
 * @param {string}  context - Caller name for error logging
 * @throws {AppError} 404   - If item doesn't exist or is not a guild item
 * @throws {AppError} 403   - If item has not been unlocked by the guild
 * @returns {Promise<{IS_EQUIPPED: boolean, TYPE: string}>} - GuildUnlock row
 */
const assertGuildItemUnlocked = async (db, guildId, itemId, context) => {
  // Verify item exists and is a guild item
  const [[item]] = await db.query(
    'SELECT ID, TYPE FROM StoreItem WHERE ID = ? AND IS_GUILD_ITEM = 1',
    [itemId]
  );
  if (!item)
  {
    throw new AppError(`[${context}] Item ${itemId} not found or not a guild item`, 404, 'Item not found');
  }

  // Check GuildUnlock row exists
  const [[unlock]] = await db.query(
    'SELECT IS_EQUIPPED, TYPE FROM GuildUnlock gu JOIN StoreItem si ON si.ID = gu.ITEM_ID WHERE gu.GUILD_ID = ? AND gu.ITEM_ID = ?',
    [guildId, itemId]
  );
  if (!unlock)
  {
    throw new AppError(`[${context}] Guild ${guildId} has not unlocked item ${itemId}`, 403, 'Item not unlocked');
  }

  return unlock;
};

/**
 * Helper function, verifies a guild exists and returns it.
 *
 * @param {Object}  db      - Database connection pool
 * @param {number}  guildId - Guild ID
 * @param {string}  context - Caller name for error logging
 * @throws {AppError} 404   - If guild not found
 * @returns {Promise<Object>} - Guild row
 */
const assertGuildExists = async (db, guildId, context) => {
  const [[guild]] = await db.query(
    'SELECT * FROM Guild WHERE ID = ?',
    [guildId]
  );
  if (!guild)
  {
    throw new AppError(`[${context}] Guild ${guildId} not found`, 404, 'Guild not found');
  }
  return guild;
};

/**
 * @route   GET /api/guilds/name/generate
 * @desc    Generate a unique guild name in the form "[adjective] [plural noun]"
 *          Guaranteed to generate a name that isn't taken yet by a guild.
 *          Signs a JWT name token that is checked in createGuild
 *          to ensure users can't create a Guild with an arbitrary name
 *          other than the ones produced by this endpoint.
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 500                 - Adjectives or plural nouns list is empty
 * @throws  {AppError} 503                 - All available guild names are in use, we need to add more!
 * @returns {Promise<void>}                - Sends HTTP/JSON response with new guild name
 */
const generateGuildName = asyncHandler(async (req, res) => {
  const { adjectives, pluralNouns } = guildNames;

  // Verify there are names to choose from
  if (!adjectives?.length || !pluralNouns?.length)
  {
    throw new AppError(`Adjectives or plural nouns list is empty`, 500, 'Guild name word bank is currently unavailable.');
  }

  // Get all the names of every guild (we want to avoid these)
  const [guildRows] = await req.db.query(
    'SELECT NAME FROM Guild'
  );

  // Map rows to a set of taken names
  const takenSet = new Set(guildRows.map(row => row.NAME));

  // Put all available name combinations in an array
  const availableNames = [];
  for (const adj of adjectives)
  {
    for (const noun of pluralNouns)
    {
      const name = `${adj} ${noun}`;
      if (!takenSet.has(name)) 
      {
        // This combination isn't used, so it's available
        availableNames.push(name);
      }
    }
  }

  if (availableNames.length === 0)
  {
    throw new AppError('All guild names are taken, add more!', 503, 'All guild names are currently in use, come back later for more!');
  }

  // Return a random name from the list
  const name = availableNames[Math.floor(Math.random() * availableNames.length)];

  // Sign name token
  const token = jwt.sign(
    { guildName: name, userId: req.user.id },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  return res.status(200).json({ name, nameToken: token });
});

/**
 * @route   POST /api/guilds
 * @desc    Create a new Guild for a user. Requesting user becomes Owner.
 *          Atomically inserts Guild and GuildMember rows in a transaction.
 *          User must not already be in a guild or own one.
 *          Prevents arbitrary name choice by verifying a dedicated
 *          name token created by GET /api/guilds/name/generate
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Missing name field
 * @throws  {AppError} 409                 - User already in a guild, or name taken
 * @returns {Promise<void>}                - Sends HTTP/JSON response with new guild ID
 */
const createGuild = asyncHandler(async (req, res) => {
  const context = 'createGuild';
  const userId  = req.user.id;
  const name = req.guildName; // Verified by validateNameToken middleware

  if (!name || !name.trim())
  {
    throw new AppError(`[${context}] Missing guild name`, 400, 'Guild name is required');
  }

  // User must not already be a guild member
  const [[existingMembership]] = await req.db.query(
    'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
    [userId]
  );
  if (existingMembership)
  {
    throw new AppError(`[${context}] User ${userId} is already in a guild`, 409, 'You are already in a guild');
  }

  // Name must be unique
  const [[existingGuild]] = await req.db.query(
    'SELECT ID FROM Guild WHERE NAME = ?',
    [name]
  );
  if (existingGuild)
  {
    throw new AppError(`[${context}] Guild name already taken: ${name}`, 409, 'Guild name is already taken');
  }

  // Atomically create guild and insert owner as member
  const conn = await req.db.getConnection();
  try
  {
    await conn.beginTransaction();

    const [guildResult] = await conn.query(
      'INSERT INTO Guild (NAME, OWNER_ID) VALUES (?, ?)',
      [name, userId]
    );
    const guildId = guildResult.insertId;

    await conn.query(
      'INSERT INTO GuildMember (USER_ID, GUILD_ID, ROLE) VALUES (?, ?, ?)',
      [userId, guildId, 'Owner']
    );

    await conn.commit();

    // Notify Discord and return success
    notifyUserEvent(`Guild created: ${name} (ID ${guildId}) by user ${userId}`);
    return res.status(201).json({ message: 'Guild created successfully', guildId, name });
  }
  catch (err)
  {
    await conn.rollback();
    throw err;
  }
  finally
  {
    conn.release();
  }
});

/**
 * @route   DELETE /api/guilds/:id/leave
 * @desc    Leave a guild. Member or Officer only.
 *          Owners cannot leave, they must delete the guild.
 * @access  Protected, member or officer only
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Invalid guild ID
 * @throws  {AppError} 403                 - Owner cannot leave, or not a member
 * @throws  {AppError} 404                 - Guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming leave
 */
const leaveGuild = asyncHandler(async (req, res) => {
  const context = 'leaveGuild';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  await assertGuildExists(req.db, guildId, context);

  // assertGuildRole also confirms membership, Owner excluded intentionally
  await assertGuildRole(req.db, userId, guildId, ['Member', 'Officer'], context);

  await req.db.query(
    'DELETE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [userId, guildId]
  );

  return res.status(200).json({ message: 'Left guild successfully' });
});

/**
 * @route   DELETE /api/guilds/:id
 * @desc    Delete a guild. Owner only. Cascades to GuildMember and GuildEntry.
 * @access  Protected, owner only
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 403                 - If caller is not Owner
 * @throws  {AppError} 404                 - If guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON response confirming deletion
 */
const deleteGuild = asyncHandler(async (req, res) => {
  const context = 'deleteGuild';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  const guild = await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Owner'], context);

  await req.db.query('DELETE FROM Guild WHERE ID = ?', [guildId]);

  // Notify Discord and return success
  notifyUserEvent(`Guild deleted: ${guild.NAME} (ID ${guildId}) by user ${userId}`);
  return res.status(200).json({ message: 'Guild deleted successfully' });
});

/**
 * @route   GET /api/guilds/:id
 * @desc    Get guild info alongside currently equipped guild items.
 *          Mirrors getUserInfo structure.
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 404                 - If guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON response with guild info and equipped items
 */
const getGuildInfo = asyncHandler(async (req, res) => {
  const context = 'getGuildInfo';
  const guildId = parseInt(req.params.id);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  const [[guildRows], [equippedItems], [members], [unlockedItems]] = await Promise.all([
    req.db.query(
      'SELECT ID, NAME, OWNER_ID, LIFETIME_EXP, WEEKLY_EXP, COINS, DAILY_EXP, ESTABLISHED, IS_OPEN FROM Guild WHERE ID = ?',
      [guildId]
    ),
    req.db.query(
      `SELECT si.ID, si.TYPE, si.COST, si.NAME
       FROM GuildUnlock gu
       JOIN StoreItem si ON si.ID = gu.ITEM_ID
       WHERE gu.GUILD_ID = ? AND gu.IS_EQUIPPED = 1`,
      [guildId]
    ),
    req.db.query(
      `SELECT u.ID, u.USERNAME, u.FIRSTNAME, u.LASTNAME, gm.ROLE, gm.COINS_CONTRIBUTED, gm.JOINED
      FROM GuildMember gm
      JOIN User u ON u.ID = gm.USER_ID
      WHERE gm.GUILD_ID = ?
      ORDER BY FIELD(gm.ROLE, 'Owner', 'Officer', 'Member'), u.USERNAME ASC`,
      [guildId]
    ),
    req.db.query(
      `SELECT si.ID, si.TYPE, si.COST, si.NAME, gu.IS_EQUIPPED
      FROM GuildUnlock gu
      JOIN StoreItem si ON si.ID = gu.ITEM_ID
      WHERE gu.GUILD_ID = ?`,
      [guildId]
    ),
  ]);

  guild = guildRows[0];

  if (!guild)
  {
    throw new AppError(`[${context}] Guild ${guildId} not found`, 404, 'Guild not found');
  }

  return res.status(200).json({ guild, equippedItems, members, unlockedItems });
});

/**
 * @route   POST /api/guilds/:id/contribute
 * @desc    Contribute coins from user balance to guild coin bank.
 *          Atomically deducts from user and increments guild bank.
 *          After update, auto-unlocks any guild items newly eligible by cost threshold.
 * @access  Protected, any guild member
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Invalid amount or insufficient coins
 * @throws  {AppError} 403                 - If caller is not a guild member
 * @throws  {AppError} 404                 - If guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON with updated coin bank and newly unlocked items
 */
const contributeCoins = asyncHandler(async (req, res) => {
  const context = 'contributeCoins';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);
  const { amount } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  if (!amount || isNaN(amount) || amount <= 0)
  {
    throw new AppError(`[${context}] Invalid contribution amount: ${amount}`, 400, 'Amount must be a positive number');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Member', 'Officer', 'Owner'], context);

  // Get user's current coin balance
  const [[user]] = await req.db.query(
    'SELECT COINS FROM User WHERE ID = ?',
    [userId]
  );
  if (user.COINS < amount)
  {
    throw new AppError(`[${context}] User ${userId} has insufficient coins`, 400, 'Insufficient coins');
  }

  // Atomically deduct from user and add to guild bank
  const conn = await req.db.getConnection();
  try
  {
    await conn.beginTransaction();

    await conn.query(
      'UPDATE User SET COINS = COINS - ? WHERE ID = ?',
      [amount, userId]
    );
    await conn.query(
      'UPDATE Guild SET COINS = COINS + ? WHERE ID = ?',
      [amount, guildId]
    );
    await conn.query(
      'UPDATE GuildMember SET COINS_CONTRIBUTED = COINS_CONTRIBUTED + ? WHERE USER_ID = ? AND GUILD_ID = ?',
      [amount, userId, guildId]
    );

    await conn.commit();
  }
  catch (err)
  {
    await conn.rollback();
    throw err;
  }
  finally
  {
    conn.release();
  }

  // Get updated coin bank total
  const [[updatedGuild]] = await req.db.query(
    'SELECT COINS FROM Guild WHERE ID = ?',
    [guildId]
  );
  const coinBank = updatedGuild.COINS;

  // Get all guild items not yet unlocked by this guild
  const [lockedItems] = await req.db.query(
    `SELECT si.ID, si.COST, si.NAME, si.TYPE
     FROM StoreItem si
     WHERE si.IS_GUILD_ITEM = 1
     AND si.ID NOT IN (
       SELECT ITEM_ID FROM GuildUnlock WHERE GUILD_ID = ?
     )`,
    [guildId]
  );

  // Auto-unlock any items whose cost threshold is now met
  const newlyUnlocked = [];
  for (const item of lockedItems)
  {
    if (coinBank >= item.COST)
    {
      await req.db.query(
        'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
        [guildId, item.ID]
      );
      newlyUnlocked.push({ id: item.ID, name: item.NAME, type: item.TYPE });
    }
  }

  return res.status(200).json({
    message:       'Contribution successful',
    coinBank,
    newlyUnlocked,
  });
});

/**
 * @route   DELETE /api/guilds/:id/members/:userId
 * @desc    Kick a member from the guild.
 *          Owner can kick anyone except themselves.
 *          Officer can kick Members only, not other Officers or Owner.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Owner cannot kick themselves
 * @throws  {AppError} 403                 - Insufficient role to kick target
 * @throws  {AppError} 404                 - Guild or target member not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming kick
 */
const kickMember = asyncHandler(async (req, res) => {
  const context  = 'kickMember';
  const callerId = req.user.id;
  const guildId  = parseInt(req.params.id);
  const targetId = parseInt(req.params.userId);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }
  if (isNaN(targetId) || targetId <= 0)
  {
    throw new AppError(`[${context}] Invalid user ID: ${req.params.userId}`, 400, 'Invalid user ID');
  }

  await assertGuildExists(req.db, guildId, context);
  const callerRole = await assertGuildRole(req.db, callerId, guildId, ['Officer', 'Owner'], context);

  // Owner cannot kick themselves, they must delete the guild
  if (callerRole === 'Owner' && callerId === targetId)
  {
    throw new AppError(`[${context}] Owner cannot kick themselves`, 400, 'Owner cannot kick themselves. Delete the guild instead.');
  }

  // Get target's role
  const [[target]] = await req.db.query(
    'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [targetId, guildId]
  );
  if (!target)
  {
    throw new AppError(`[${context}] Target user ${targetId} is not a member of guild ${guildId}`, 404, 'Member not found');
  }

  // Officers can only kick Members, not other Officers or Owner
  if (callerRole === 'Officer' && target.ROLE !== 'Member')
  {
    throw new AppError(`[${context}] Officer cannot kick ${target.ROLE}`, 403, 'Forbidden');
  }

  await req.db.query(
    'DELETE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [targetId, guildId]
  );

  return res.status(200).json({ message: 'Member kicked successfully' });
});

/**
 * @route   PATCH /api/guilds/:id/members/:userId/role
 * @desc    Promote or demote a guild member.
 *          Owner can promote Members to Officer and demote Officers to Member.
 *          Officer can promote Members to Officer only, cannot demote.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Invalid new role or invalid IDs
 * @throws  {AppError} 403                 - Insufficient role to perform change
 * @throws  {AppError} 404                 - Guild or target member not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming role change
 */
const updateMemberRole = asyncHandler(async (req, res) => {
  const context   = 'updateMemberRole';
  const callerId  = req.user.id;
  const guildId   = parseInt(req.params.id);
  const targetId  = parseInt(req.params.userId);
  const { newRole } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }
  if (isNaN(targetId) || targetId <= 0)
  {
    throw new AppError(`[${context}] Invalid user ID: ${req.params.userId}`, 400, 'Invalid user ID');
  }
  if (!['Member', 'Officer'].includes(newRole))
  {
    throw new AppError(`[${context}] Invalid role: ${newRole}`, 400, 'Role must be Member or Officer');
  }

  await assertGuildExists(req.db, guildId, context);
  const callerRole = await assertGuildRole(req.db, callerId, guildId, ['Officer', 'Owner'], context);

  const [[target]] = await req.db.query(
    'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [targetId, guildId]
  );
  if (!target)
  {
    throw new AppError(`[${context}] Target ${targetId} is not a member of guild ${guildId}`, 404, 'Member not found');
  }

  // Officers can only promote Members to Officer, cannot demote
  if (callerRole === 'Officer')
  {
    if (target.ROLE !== 'Member' || newRole !== 'Officer')
    {
      throw new AppError(`[${context}] Officer can only promote Members to Officer`, 403, 'Forbidden');
    }
  }

  // Owner cannot be demoted via this endpoint
  if (target.ROLE === 'Owner')
  {
    throw new AppError(`[${context}] Cannot change Owner role`, 403, 'Forbidden');
  }

  await req.db.query(
    'UPDATE GuildMember SET ROLE = ? WHERE USER_ID = ? AND GUILD_ID = ?',
    [newRole, targetId, guildId]
  );

  return res.status(200).json({ message: `Member role updated to ${newRole}` });
});

/**
 * @route   PUT /api/guilds/:id/equip
 * @desc    Equip an unlocked guild item. Officer or Owner only.
 *          Auto-swaps for item types with equip limit of 1.
 *          Returns 409 if equip limit exceeded for types with limit > 1.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Item already equipped or invalid IDs
 * @throws  {AppError} 403                 - Item not unlocked or insufficient role
 * @throws  {AppError} 404                 - Guild or item not found
 * @throws  {AppError} 409                 - Equip limit reached for item type
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming equip
 */
const equipGuildItem = asyncHandler(async (req, res) => {
  const context = 'equipGuildItem';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);
  const { itemId } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Officer', 'Owner'], context);

  const { IS_EQUIPPED: isEquipped, TYPE: itemType } = await assertGuildItemUnlocked(req.db, guildId, itemId, context);

  if (isEquipped)
  {
    throw new AppError(`[${context}] Item ${itemId} is already equipped`, 400, 'Item is already equipped');
  }

  // Check equip limit for this item type
  const limit = EQUIP_LIMITS[itemType];
  if (limit !== undefined)
  {
    const [[{ count }]] = await req.db.query(
      `SELECT COUNT(*) AS count
       FROM GuildUnlock gu
       JOIN StoreItem si ON si.ID = gu.ITEM_ID
       WHERE gu.GUILD_ID = ? AND si.TYPE = ? AND gu.IS_EQUIPPED = 1`,
      [guildId, itemType]
    );

    if (count >= limit)
    {
      if (limit === 1)
      {
        // Auto-swap: unequip current item of this type
        await req.db.query(
          `UPDATE GuildUnlock gu
           JOIN StoreItem si ON si.ID = gu.ITEM_ID
           SET gu.IS_EQUIPPED = 0
           WHERE gu.GUILD_ID = ? AND si.TYPE = ? AND gu.IS_EQUIPPED = 1`,
          [guildId, itemType]
        );
      }
      else
      {
        throw new AppError(
          `[${context}] Guild ${guildId} has reached equip limit for type ${itemType}`,
          409,
          `Equip limit reached for ${itemType} (max ${limit})`
        );
      }
    }
  }

  await req.db.query(
    'UPDATE GuildUnlock SET IS_EQUIPPED = 1 WHERE GUILD_ID = ? AND ITEM_ID = ?',
    [guildId, itemId]
  );

  return res.status(200).json({ message: 'Item equipped successfully' });
});

/**
 * @route   PUT /api/guilds/:id/unequip
 * @desc    Unequip an equipped guild item. Officer or Owner only.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Item not equipped or invalid IDs
 * @throws  {AppError} 403                 - Item not unlocked or insufficient role
 * @throws  {AppError} 404                 - Guild or item not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming unequip
 */
const unequipGuildItem = asyncHandler(async (req, res) => {
  const context = 'unequipGuildItem';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);
  const { itemId } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Officer', 'Owner'], context);

  const { IS_EQUIPPED: isEquipped } = await assertGuildItemUnlocked(req.db, guildId, itemId, context);

  if (!isEquipped)
  {
    throw new AppError(`[${context}] Item ${itemId} is not equipped`, 400, 'Item is not equipped');
  }

  await req.db.query(
    'UPDATE GuildUnlock SET IS_EQUIPPED = 0 WHERE GUILD_ID = ? AND ITEM_ID = ?',
    [guildId, itemId]
  );

  return res.status(200).json({ message: 'Item unequipped successfully' });
});

/**
 * @route   POST /api/guilds/:id/invite
 * @desc    Invite a user to the guild. Officer or Owner only.
 *          Target must not already be a member of this guild.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Target already a member or invalid IDs
 * @throws  {AppError} 403                 - Insufficient role
 * @throws  {AppError} 404                 - Guild or target user not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming invite sent
 */
const inviteUser = asyncHandler(async (req, res) => {
  const context  = 'inviteUser';
  const callerId = req.user.id;
  const guildId  = parseInt(req.params.id);
  const { targetUserId } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }
  if (!targetUserId || isNaN(targetUserId) || targetUserId <= 0)
  {
    throw new AppError(`[${context}] Invalid target user ID: ${targetUserId}`, 400, 'Invalid user ID');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, callerId, guildId, ['Officer', 'Owner'], context);

  // Verify target user exists
  const [[targetUser]] = await req.db.query(
    'SELECT ID FROM User WHERE ID = ?',
    [targetUserId]
  );
  if (!targetUser)
  {
    throw new AppError(`[${context}] Target user ${targetUserId} not found`, 404, 'User not found');
  }

  // Target must not already be a member
  const [[existingMember]] = await req.db.query(
    'SELECT USER_ID FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [targetUserId, guildId]
  );
  if (existingMember)
  {
    throw new AppError(`[${context}] User ${targetUserId} is already a member of guild ${guildId}`, 400, 'User is already a member');
  }

  // IGNORE means if invite already exists this is a no-op rather than an error
  await req.db.query(
    'INSERT IGNORE INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, ?)',
    [targetUserId, guildId, 'Invite']
  );

  return res.status(200).json({ message: 'Invite sent successfully' });
});

/**
 * @route   POST /api/guilds/:id/request
 * @desc    Request to join a guild, can be done by any authenticated user
 *          User must not already be a member of this guild
 *          Guild owners cannot request to join another guild,
 *          they must delete their guild first.
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Already a member of this guild
 * @throws  {AppError} 409                 - Caller owns a guild (distinct from 403)
 * @throws  {AppError} 404                 - Guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON confirming request sent
 */
const requestToJoin = asyncHandler(async (req, res) => {
  const context = 'requestToJoin';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  const guild = await assertGuildExists(req.db, guildId, context);

  // Block join requests if guild is not open
  if (!guild.IS_OPEN)
  {
    throw new AppError(
      `[${context}] Guild ${guildId} is not open to join requests`,
      403,
      'This guild is not accepting join requests'
    );
  }

  // Block guild owners, they must delete their guild first
  const [[ownedGuild]] = await req.db.query(
    'SELECT ID FROM Guild WHERE OWNER_ID = ?',
    [userId]
  );
  if (ownedGuild)
  {
    throw new AppError(
      `[${context}] User ${userId} owns a guild and cannot request to join another`,
      409,
      'You must delete your guild before joining another'
    );
  }

  // Block if already a member of this guild
  const [[existingMember]] = await req.db.query(
    'SELECT USER_ID FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
    [userId, guildId]
  );
  if (existingMember)
  {
    throw new AppError(`[${context}] User ${userId} is already a member of guild ${guildId}`, 400, 'You are already a member of this guild');
  }

  await req.db.query(
    'INSERT IGNORE INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, ?)',
    [userId, guildId, 'Request']
  );

  return res.status(200).json({ message: 'Join request sent successfully' });
});

/**
 * @route   PATCH /api/guilds/:id/entry/:userId
 * @desc    Accept or reject a guild entry (invite or join request).
 *          For INVITE: accepting party is the invitee (req.user).
 *          For REQUEST: accepting party is Officer or Owner.
 *          On rejection: GuildEntry row deleted.
 *          On acceptance: GuildEntry deleted and GuildMember inserted atomically.
 * 
 *          Handles three membership state transitions:
 *            - No guild: inserts GuildMember directly
 *            - Member/Officer of another guild: returns flag for frontend confirmation;
 *              if confirmed, old membership deleted and new one inserted atomically
 *            - Owner of another guild: rejected with 409
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Invalid IDs or action
 * @throws  {AppError} 403                 - Not authorized to act on this entry
 * @throws  {AppError} 404                 - Guild, entry, or user not found
 * @throws  {AppError} 409                 - Target owns another guild, or guild at max size
 * @returns {Promise<void>}                - Sends HTTP/JSON with result
 */
const resolveEntry = asyncHandler(async (req, res) => {
  const context      = 'resolveEntry';
  const callerId     = req.user.id;
  const guildId      = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);
  const { action, confirmLeave } = req.body; // action: 'accept' | 'reject'

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }
  if (isNaN(targetUserId) || targetUserId <= 0)
  {
    throw new AppError(`[${context}] Invalid user ID: ${req.params.userId}`, 400, 'Invalid user ID');
  }
  if (!['accept', 'reject'].includes(action))
  {
    throw new AppError(`[${context}] Invalid action: ${action}`, 400, 'Action must be accept or reject');
  }

  await assertGuildExists(req.db, guildId, context);

  // Fetch the entry
  const [[entry]] = await req.db.query(
    'SELECT TYPE FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
    [targetUserId, guildId]
  );
  if (!entry)
  {
    throw new AppError(`[${context}] No entry found for user ${targetUserId} in guild ${guildId}`, 404, 'Entry not found');
  }

  // for Invite, caller must be the invitee
  // for Request, caller must be Officer or Owner
  if (entry.TYPE === 'Invite')
  {
    if (callerId !== targetUserId)
    {
      throw new AppError(`[${context}] Only the invitee can accept/reject an invite`, 403, 'Forbidden');
    }
  }
  else // Request
  {
    await assertGuildRole(req.db, callerId, guildId, ['Officer', 'Owner'], context);
  }

  // Rejection: just delete the entry
  if (action === 'reject')
  {
    await req.db.query(
      'DELETE FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
      [targetUserId, guildId]
    );
    return res.status(200).json({ message: 'Entry rejected successfully' });
  }

  // Acceptance: check guild size cap
  const [[{ memberCount }]] = await req.db.query(
    'SELECT COUNT(*) AS memberCount FROM GuildMember WHERE GUILD_ID = ?',
    [guildId]
  );
  if (memberCount >= MAX_GUILD_SIZE)
  {
    throw new AppError(`[${context}] Guild ${guildId} is at max size`, 409, 'Guild is full');
  }

  // Check target's current membership state
  const [[existingMembership]] = await req.db.query(
    'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
    [targetUserId]
  );

  // Block owners of another guild
  const [[ownedGuild]] = await req.db.query(
    'SELECT ID FROM Guild WHERE OWNER_ID = ?',
    [targetUserId]
  );
  if (ownedGuild)
  {
    throw new AppError(
      `[${context}] User ${targetUserId} owns a guild and cannot join another`,
      409,
      'User must delete their guild before joining another'
    );
  }

  // If target is in another guild, require frontend confirmation before leaving
  if (existingMembership && !confirmLeave)
  {
    return res.status(200).json({
      requiresConfirmation: true,
      message:              'User is already a member of another guild. Set confirmLeave: true to proceed.',
    });
  }

  // Atomically handle membership transition and accept entry
  const conn = await req.db.getConnection();
  try
  {
    await conn.beginTransaction();

    // Remove from current guild if applicable
    if (existingMembership)
    {
      await conn.query(
        'DELETE FROM GuildMember WHERE USER_ID = ?',
        [targetUserId]
      );
    }

    // Delete the entry and insert new membership
    await conn.query(
      'DELETE FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
      [targetUserId, guildId]
    );
    await conn.query(
      'INSERT INTO GuildMember (USER_ID, GUILD_ID, ROLE) VALUES (?, ?, ?)',
      [targetUserId, guildId, 'Member']
    );

    await conn.commit();
  }
  catch (err)
  {
    await conn.rollback();
    throw err;
  }
  finally
  {
    conn.release();
  }

  return res.status(200).json({ message: 'Entry accepted, user is now a guild member' });
});

/**
 * @route   GET /api/users/me/guild-invites
 * @desc    Get all pending guild invites for the current user.
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>}                - Sends HTTP/JSON with pending invites
 */
const getMyInvites = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [invites] = await req.db.query(
    `SELECT ge.GUILD_ID, g.NAME AS guildName, g.OWNER_ID
     FROM GuildEntry ge
     JOIN Guild g ON g.ID = ge.GUILD_ID
     WHERE ge.USER_ID = ? AND ge.TYPE = 'Invite'`,
    [userId]
  );

  return res.status(200).json({ invites });
});

/**
 * @route   GET /api/guilds/:id/requests
 * @desc    Get all pending join requests for a guild. Officer or Owner only.
 * @access  Protected, officer or owner
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 403                 - Insufficient role
 * @throws  {AppError} 404                 - Guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON with pending requests
 */
const getGuildRequests = asyncHandler(async (req, res) => {
  const context = 'getGuildRequests';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Officer', 'Owner'], context);

  const [requests] = await req.db.query(
    `SELECT ge.USER_ID, u.USERNAME, u.FIRSTNAME, u.LASTNAME
     FROM GuildEntry ge
     JOIN User u ON u.ID = ge.USER_ID
     WHERE ge.GUILD_ID = ? AND ge.TYPE = 'Request'`,
    [guildId]
  );

  return res.status(200).json({ requests });
});

/**
 * @route   PATCH /api/guilds/:id/open
 * @desc    Toggle guild open/closed status for join requests.
 *          Officer or Owner only.
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 400                 - Invalid guild ID or isOpen not a boolean
 * @throws  {AppError} 403                 - Insufficient role
 * @throws  {AppError} 404                 - Guild not found
 * @returns {Promise<void>}                - Sends HTTP/JSON with new open state
 */
const updateGuildOpen = asyncHandler(async (req, res) => {
  const context = 'updateGuildOpen';
  const userId  = req.user.id;
  const guildId = parseInt(req.params.id);
  const { isOpen } = req.body;

  if (isNaN(guildId) || guildId <= 0)
  {
    throw new AppError(`[${context}] Invalid guild ID: ${req.params.id}`, 400, 'Invalid guild ID');
  }

  if (typeof isOpen !== 'boolean')
  {
    throw new AppError(`[${context}] Invalid isOpen value: ${isOpen}`, 400, 'isOpen must be a boolean');
  }

  await assertGuildExists(req.db, guildId, context);
  await assertGuildRole(req.db, userId, guildId, ['Officer', 'Owner'], context);

  await req.db.query(
    'UPDATE Guild SET IS_OPEN = ? WHERE ID = ?',
    [isOpen ? 1 : 0, guildId]
  );

  return res.status(200).json({
    message: `Guild is now ${isOpen ? 'open' : 'closed'} to join requests`,
    isOpen,
  });
});

module.exports = {
  generateGuildName,
  createGuild,
  leaveGuild,
  deleteGuild,
  getGuildInfo,
  contributeCoins,
  kickMember,
  updateMemberRole,
  equipGuildItem,
  unequipGuildItem,
  inviteUser,
  requestToJoin,
  resolveEntry,
  getMyInvites,
  getGuildRequests,
  updateGuildOpen,
};
