////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildLeaderboard.test.js
//  Description:   Integration tests for guild leaderboard endpoints:
//                 GET /api/leaderboard/guilds/weekly
//                 GET /api/leaderboard/guilds/lifetime
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../../server');
const {
        TEST_USER,
        verifyTestDatabase,
        getAuthToken,
        insertUser,
        insertGuildWithOwner,
        insertGuildMember,
      } = require('../testHelpers');

let token;
let userId;

// Guild IDs seeded for leaderboard tests
let guildIds = [];

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');
  await pool.query('DELETE FROM Guild');

  token = await getAuthToken();
  const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  userId = rows[0].ID;

  // Insert three guild owners
  const ownerAId = await insertUser({ username: 'lb_owner_a', email: 'lb_owner_a@test.com' });
  const ownerBId = await insertUser({ username: 'lb_owner_b', email: 'lb_owner_b@test.com' });
  const ownerCId = await insertUser({ username: 'lb_owner_c', email: 'lb_owner_c@test.com' });

  // Insert guilds with known exp values
  // Guild A: highest exp
  const guildAId = await insertGuildWithOwner(ownerAId, { name: 'Guild Alpha', weeklyExp: 900, lifetimeExp: 9000 });
  // Guild B: middle exp, test user's guild
  const guildBId = await insertGuildWithOwner(ownerBId, { name: 'Guild Beta', weeklyExp: 600, lifetimeExp: 6000 });
  // Guild C: lowest exp
  const guildCId = await insertGuildWithOwner(ownerCId, { name: 'Guild Gamma', weeklyExp: 300, lifetimeExp: 3000 });

  guildIds = [guildAId, guildBId, guildCId];

  // Make test user a member of Guild B so they have a guild rank to assert
  await insertGuildMember(userId, guildBId, 'Member');
});

afterAll(async () => {
  await pool.query('DELETE FROM Guild');
  await pool.query('DELETE FROM User');
  try { await pool.end(); }
  catch (err) { console.error('Error closing pool in guildLeaderboard.test.js:', err); }
});

// Test weekly guild leaderboard
describe('GET /api/leaderboard/guilds/weekly', () => {

  test('200 - returns leaderboard with correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('guildRank');
    expect(res.body).toHaveProperty('guildExp');
    expect(res.body).toHaveProperty('guildId');
  });

  test('200 - leaderboard entries have correct fields', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard.length).toBeGreaterThan(0);

    const entry = res.body.leaderboard[0];
    expect(entry).toHaveProperty('rank');
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('name');
    expect(entry).toHaveProperty('exp');
    expect(entry).toHaveProperty('guildPicture');
  });

  test('200 - guilds ranked highest exp first', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.leaderboard.map(g => g.name);
    expect(names[0]).toBe('Guild Alpha');
    expect(names[1]).toBe('Guild Beta');
    expect(names[2]).toBe('Guild Gamma');
  });

  test('200 - rank 1 guild has highest weekly exp', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].rank).toBe(1);
    expect(res.body.leaderboard[0].exp).toBe(900);
  });

  test('200 - returns requesting user guild rank and exp', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Test user is in Guild B which has rank 2
    expect(res.body.guildRank).toBe(2);
    expect(res.body.guildExp).toBe(600);
    expect(res.body.guildId).toBe(guildIds[1]);
  });

  test('200 - guildRank, guildExp, guildId are null when user not in a guild', async () => {
    // Insert a user with no guild membership
    const noGuildUserId = await insertUser({ username: 'no_guild_user', email: 'no_guild@test.com' });
    const noGuildToken  = await (async () => {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash('Testpass123!', 10);
      await pool.query(
        'UPDATE User SET PASSWORD = ? WHERE ID = ?',
        [hashed, noGuildUserId]
      );
      // Login directly
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'no_guild_user', password: 'Testpass123!' });
      return res.body.token;
    })();

    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly')
      .set('Authorization', `Bearer ${noGuildToken}`);

    expect(res.status).toBe(200);
    expect(res.body.guildRank).toBeNull();
    expect(res.body.guildExp).toBeNull();
    expect(res.body.guildId).toBeNull();

    await pool.query('DELETE FROM User WHERE ID = ?', [noGuildUserId]);
  });

  test('200 - pagination metadata is correct', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly?page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(1);
  });

  test('200 - out of range page clamps to last page', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly?page=99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(res.body.totalPages);
  });

  test('200 - invalid page clamps to 1', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly?page=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/weekly');

    expect(res.status).toBe(401);
  });

});

// Test lifetime guild leaderboard
describe('GET /api/leaderboard/guilds/lifetime', () => {

  test('200 - returns leaderboard with correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('guildRank');
    expect(res.body).toHaveProperty('guildExp');
  });

  test('200 - guilds ranked by lifetime exp', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.leaderboard.map(g => g.name);
    expect(names[0]).toBe('Guild Alpha');
    expect(names[2]).toBe('Guild Gamma');
  });

  test('200 - rank 1 guild has highest lifetime exp', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].rank).toBe(1);
    expect(res.body.leaderboard[0].exp).toBe(9000);
  });

  test('200 - user guild rank reflects lifetime exp ranking', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.guildRank).toBe(2);
    expect(res.body.guildExp).toBe(6000);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/guilds/lifetime');

    expect(res.status).toBe(401);
  });
});
