////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          currencyUtils.test.js
//  Description:   Unit tests for guild exp contribution:
//                 awardGuildExp()
//
//                 Note: awardCurrency() is covered by test.test.js
//                 Daily EXP Cap Tests. Tests here focus on
//                 guild-specific passive exp behavior.
//
//  Dependencies:  mysql2 connection pool (server.js)
//                 testHelpers
//                 currencyConfig
//                 guildConfig
//
////////////////////////////////////////////////////////////////

const { pool } = require('../server');
const {
        TEST_USER,
        verifyTestDatabase,
        getAuthToken,
        insertUser,
        insertGuildWithOwner,
        insertGuildMember,
      } = require('./testHelpers');
const { awardGuildExp } = require('../utils/currencyUtils');
const { EXP_PER_POINT } = require('../../shared/currencyConfig');
const { GUILD_EXP_CONTRIBUTION_RATIO } = require('../../shared/guildConfig');

let userId;

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');
  await pool.query('DELETE FROM Guild');

  await getAuthToken();
  const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  userId = rows[0].ID;
});

beforeEach(async () => {
  await pool.query(
    'UPDATE User SET COINS = 0, DAILY_EXP = 0, WEEKLY_EXP = 0, LIFETIME_EXP = 0 WHERE ID = ?',
    [userId]
  );
  await pool.query('DELETE FROM Guild');
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try { await pool.end(); }
  catch (err) { console.error('Error closing pool in currencyUtils.test.js:', err); }
});

describe('awardGuildExp', () => {

  test('adds exp to all three guild exp banks when user is a member', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Exp Guild' });

    await awardGuildExp(pool, userId, 10);

    const [[guild]] = await pool.query(
      'SELECT DAILY_EXP, WEEKLY_EXP, LIFETIME_EXP FROM Guild WHERE ID = ?',
      [guildId]
    );

    const expectedGuildExp = 10 * EXP_PER_POINT * GUILD_EXP_CONTRIBUTION_RATIO;
    expect(guild.DAILY_EXP).toBeCloseTo(expectedGuildExp);
    expect(guild.WEEKLY_EXP).toBeCloseTo(expectedGuildExp);
    expect(guild.LIFETIME_EXP).toBeCloseTo(expectedGuildExp);
  });

  test('does not decrement user exp', async () => {
    await pool.query(
      'UPDATE User SET DAILY_EXP = 100, WEEKLY_EXP = 100, LIFETIME_EXP = 100 WHERE ID = ?',
      [userId]
    );
    await insertGuildWithOwner(userId, { name: 'No Decrement Guild' });

    await awardGuildExp(pool, userId, 10);

    const [[user]] = await pool.query(
      'SELECT DAILY_EXP, WEEKLY_EXP, LIFETIME_EXP FROM User WHERE ID = ?',
      [userId]
    );

    expect(user.DAILY_EXP).toBe(100);
    expect(user.WEEKLY_EXP).toBe(100);
    expect(user.LIFETIME_EXP).toBe(100);
  });

  test('no-ops silently when user is not in a guild', async () => {
    // No guild exists after beforeEach cleanup, should not throw
    await expect(awardGuildExp(pool, userId, 10)).resolves.not.toThrow();
  });

  test('no-ops when points earned is zero', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Zero Points Guild' });

    await awardGuildExp(pool, userId, 0);

    const [[guild]] = await pool.query(
      'SELECT DAILY_EXP FROM Guild WHERE ID = ?',
      [guildId]
    );

    expect(guild.DAILY_EXP).toBe(0);
  });

  test('awards to correct guild when user is a non-owner member', async () => {
    const ownerId = await insertUser({ username: 'gexp_owner', email: 'gexp_owner@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Member Exp Guild' });
    await insertGuildMember(userId, guildId, 'Member');

    await awardGuildExp(pool, userId, 5);

    const [[guild]] = await pool.query(
      'SELECT WEEKLY_EXP FROM Guild WHERE ID = ?',
      [guildId]
    );

    const expectedGuildExp = 5 * EXP_PER_POINT * GUILD_EXP_CONTRIBUTION_RATIO;
    expect(guild.WEEKLY_EXP).toBeCloseTo(expectedGuildExp);
  });
});
