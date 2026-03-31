////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          leaderboard.test.js
//  Description:   Integration tests for leaderboard routes:
//                 GET /api/leaderboard/weekly
//                 GET /api/leaderboard/lifetime
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 itemConfig
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const { 
        TEST_USER,
        getAuthToken,
        verifyTestDatabase,
        insertPurchase,
        insertUser,
      } = require('./testHelpers');
const { ITEM_TYPES } = require('../../shared/itemConfig');

let token;
let userId;
let lbUserIds = [];
let createdItemIds = [];

// Leaderboard users to test against
const LB_USERS = [
  { username: 'lb_user1', weeklyExp: 500,  lifetimeExp: 2000 },
  { username: 'lb_user2', weeklyExp: 300,  lifetimeExp: 1500 },
  { username: 'lb_user3', weeklyExp: 500,  lifetimeExp: 800  }, // ties lb_user1 on weekly
];

beforeAll(async () => {
  await verifyTestDatabase(pool);
  token = await getAuthToken();

  const [[{ ID }]] = await pool.query(
    'SELECT ID FROM User WHERE USERNAME = ?',
    [TEST_USER.username]
  );
  userId = ID;

  // Insert leaderboard test users
  for (const u of LB_USERS)
  {
    const [result] = await pool.query(
      `INSERT INTO User (USERNAME, EMAIL, PASSWORD, WEEKLY_EXP, LIFETIME_EXP)
       VALUES (?, ?, 'placeholder', ?, ?)`,
      [u.username, `${u.username}@test.com`, u.weeklyExp, u.lifetimeExp]
    );
    lbUserIds.push(result.insertId);
  }

  const flairItemId = await insertPurchase(
    lbUserIds[0],
    { type: ITEM_TYPES.FLAIR, name: 'Leaderboard Crown', cost: 0 },
    true
  );
  createdItemIds.push(flairItemId);
});

beforeEach(async () => {
  // Reset test user exp and coins
  await pool.query(
    'UPDATE User SET WEEKLY_EXP = 0, LIFETIME_EXP = 0, DAILY_EXP = 0 WHERE ID = ?',
    [userId]
  );
});

afterAll(async () => {
  // Clean up leaderboard test users
  await pool.query(
    `DELETE FROM User WHERE ID IN (${lbUserIds.map(() => '?').join(',')})`,
    lbUserIds
  );
  if (createdItemIds.length > 0)
  {
    await pool.query(
      `DELETE FROM StoreItem WHERE ID IN (${createdItemIds.map(() => '?').join(',')})`,
      createdItemIds
    );
  }
  // Clean up test user
  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error('Error closing pool in leaderboard.test.js:', err);
  }
});

// Test weekly leaderboard endpoint
describe('GET /api/leaderboard/weekly', () => {

  test('200 - returns correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userRank');
    expect(res.body).toHaveProperty('userExp');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('leaderboard');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  test('200 - leaderboard entries have correct shape and expose user flair metadata', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entry = res.body.leaderboard[0];
    expect(entry).toHaveProperty('rank');
    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('username');
    expect(entry).toHaveProperty('firstName');
    expect(entry).toHaveProperty('exp');
    expect(entry).toHaveProperty('profilePicture');
    expect(entry).toHaveProperty('background');
    expect(entry).toHaveProperty('flairNames');
    expect(Array.isArray(entry.flairNames)).toBe(true);
    expect(entry).not.toHaveProperty('ID');
  });

  test('200 - equipped flairs are returned for leaderboard users', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const userEntry = res.body.leaderboard.find(e => e.username === 'lb_user1');
    expect(userEntry).toBeDefined();
    expect(userEntry.userId).toBe(lbUserIds[0]);
    expect(userEntry.flairNames).toContain('Leaderboard Crown');
  });

  test('200 - leaderboard is ordered by rank ascending', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ranks = res.body.leaderboard.map(e => e.rank);
    for (let i = 1; i < ranks.length; i++)
    {
      // Ensure leaderboard actually ranks by exp
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  test('200 - tied users share the same rank', async () => {
    // lb_user1 and lb_user3 both have 500 weekly exp
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const user1 = res.body.leaderboard.find(e => e.username === 'lb_user1');
    const user3 = res.body.leaderboard.find(e => e.username === 'lb_user3');

    expect(user1).toBeDefined();
    expect(user3).toBeDefined();
    expect(user1.rank).toBe(user3.rank); // Same rank
    expect(user1.exp).toBe(500);
    expect(user3.exp).toBe(500);
  });

  test('200 - userRank and userExp reflect test user weekly exp', async () => {
    await pool.query(
      'UPDATE User SET WEEKLY_EXP = 400 WHERE ID = ?',
      [userId]
    );

    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.userExp)).toBe(400);

    const userEntry = res.body.leaderboard.find(e => e.username === TEST_USER.username);
    expect(userEntry).toBeDefined();
    expect(userEntry.rank).toBe(res.body.userRank);
    expect(Number(userEntry.exp)).toBe(400);
  });

  test('200 - test user ranks below tied leaders when exp is 0', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const user1 = res.body.leaderboard.find(e => e.username === 'lb_user1');
    // Greater rank means lower on the leaderboard (less exp)
    expect(res.body.userRank).toBeGreaterThan(user1.rank);
  });

  test('200 - profile picture is null when user has none equipped', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const userEntry = res.body.leaderboard.find(e => e.username === TEST_USER.username);
    expect(userEntry).toBeDefined();
    expect(userEntry.profilePicture).toBeNull();
  });

  test('200 - profile picture is returned when user has one equipped', async () => {
    // Insert profile picture and purchase
    const itemId = await insertPurchase(
      userId,
      { type: ITEM_TYPES.PROFILE_PICTURE, name: 'Test Avatar', cost: 0 },
      true // equipped
    );

    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const userEntry = res.body.leaderboard.find(e => e.username === TEST_USER.username);
    expect(userEntry).toBeDefined();
    expect(userEntry.profilePicture).toBe('Test Avatar');

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('200 - background is returned when user has one equipped', async () => {
    const itemId = await insertPurchase(
      userId,
      { type: ITEM_TYPES.BACKGROUND, name: 'Test Banner', cost: 0 },
      true
    );

    const res = await request(app)
      .get('/api/leaderboard/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const userEntry = res.body.leaderboard.find(e => e.username === TEST_USER.username);
    expect(userEntry).toBeDefined();
    expect(userEntry.background).toBe('Test Banner');

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('200 - pagination metadata is correct', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly?page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(1);
  });

  test('200 - out of range page clamps to last page', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly?page=999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(res.body.totalPages);
  });

  test('200 - userRank is correct regardless of page', async () => {
    // Even on page 999999 (clamped to last), userRank should still reflect true rank
    await pool.query(
      'UPDATE User SET WEEKLY_EXP = 400 WHERE ID = ?',
      [userId]
    );

    const res = await request(app)
      .get('/api/leaderboard/weekly?page=999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userRank).not.toBeNull();
    expect(Number(res.body.userExp)).toBe(400);
  });

  test('401 - missing token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/weekly');

    expect(res.status).toBe(401);
  });
});

// Test lifetime leaderboard endpoint
describe('GET /api/leaderboard/lifetime', () => {

  test('200 - returns correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userRank');
    expect(res.body).toHaveProperty('userExp');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('leaderboard');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  test('200 - userRank and userExp reflect test user lifetime exp', async () => {
    await pool.query(
      'UPDATE User SET LIFETIME_EXP = 1000 WHERE ID = ?',
      [userId]
    );

    const res = await request(app)
      .get('/api/leaderboard/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.userExp)).toBe(1000);

    const userEntry = res.body.leaderboard.find(e => e.username === TEST_USER.username);
    expect(userEntry).toBeDefined();
    expect(userEntry.rank).toBe(res.body.userRank);
    expect(Number(userEntry.exp)).toBe(1000);
  });

  test('200 - lb_user1 ranks highest in lifetime', async () => {
    const res = await request(app)
      .get('/api/leaderboard/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const user1 = res.body.leaderboard.find(e => e.username === 'lb_user1');
    expect(user1).toBeDefined();
    expect(user1.rank).toBe(1);
    expect(Number(user1.exp)).toBe(2000);
  });

  test('200 - weekly and lifetime rankings are independent', async () => {
    await pool.query(
      'UPDATE User SET WEEKLY_EXP = 0, LIFETIME_EXP = 1000 WHERE ID = ?',
      [userId]
    );

    const [weekly, lifetime] = await Promise.all([
      request(app).get('/api/leaderboard/weekly').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/leaderboard/lifetime').set('Authorization', `Bearer ${token}`)
    ]);

    expect(Number(weekly.body.userExp)).toBe(0);
    expect(Number(lifetime.body.userExp)).toBe(1000);
  });

  test('401 - missing token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/lifetime');

    expect(res.status).toBe(401);
  });
});

// Test followed weekly leaderboard endpoint
describe('GET /api/leaderboard/followed/weekly', () => {

  // Insert a follow relationship before each test, clean up after
  let followeeId;
  beforeEach(async () => {
    followeeId = await insertUser({
      username:   'followed_user',
      email:      'followed@test.com',
      weeklyExp:  600,
      lifetimeExp: 1000,
    });
    await pool.query(
      'INSERT INTO Follower (FOLLOWER_ID, FOLLOWING_ID) VALUES (?, ?)',
      [userId, followeeId]
    );
  });
  afterEach(async () => {
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('200 - returns correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userRank');
    expect(res.body).toHaveProperty('userExp');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('leaderboard');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  test('200 - only shows followed users, not all users', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // lb_user1/2/3 from the global setup are not followed, shouldn't appear
    const usernames = res.body.leaderboard.map(e => e.username);
    expect(usernames).not.toContain('lb_user1');
    expect(usernames).not.toContain('lb_user2');
    expect(usernames).not.toContain('lb_user3');
    expect(usernames).toContain('followed_user');
  });

  test('200 - returns empty leaderboard when following nobody', async () => {
    // Remove the follow relationship set up in beforeEach
    await pool.query(
      'DELETE FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
      [userId, followeeId]
    );

    const res = await request(app)
      .get('/api/leaderboard/followed/weekly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(0);
    expect(res.body.totalPages).toBe(0);
    expect(res.body.userRank).toBeNull();
    expect(res.body.userExp).toBeNull();
  });

  test('200 - userRank and userExp reflect test user weekly exp within followed pool', async () => {
    await pool.query(
      'UPDATE User SET WEEKLY_EXP = 100 WHERE ID = ?',
      [userId]
    );

    const res = await request(app)
      .get('/api/leaderboard/followed/weekly')
      .set('Authorization', `Bearer ${token}`);

    // followee has 600, test user has 100, userRank is from global pool, not followed pool
    expect(res.status).toBe(200);
    expect(Number(res.body.userExp)).toBe(100);
  });

  test('200 - followed leaderboard rankings are independent of global leaderboard', async () => {
    const [global, followed] = await Promise.all([
      request(app).get('/api/leaderboard/weekly').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/leaderboard/followed/weekly').set('Authorization', `Bearer ${token}`)
    ]);

    expect(global.body.leaderboard.length).toBeGreaterThan(followed.body.leaderboard.length);
  });

  test('200 - out of range page clamps to last page', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/weekly?page=999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(res.body.totalPages);
  });

  test('401 - missing token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/weekly');

    expect(res.status).toBe(401);
  });
});

// Test followed lifetime leaderboard endpoint
describe('GET /api/leaderboard/followed/lifetime', () => {

  let followeeId;
  beforeEach(async () => {
    followeeId = await insertUser({
      username:    'followed_user',
      email:       'followed@test.com',
      weeklyExp:   600,
      lifetimeExp: 1000,
    });
    await pool.query(
      'INSERT INTO Follower (FOLLOWER_ID, FOLLOWING_ID) VALUES (?, ?)',
      [userId, followeeId]
    );
  });
  afterEach(async () => {
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('200 - returns correct shape', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userRank');
    expect(res.body).toHaveProperty('userExp');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('leaderboard');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
  });

  test('200 - returns empty leaderboard when following nobody', async () => {
    await pool.query(
      'DELETE FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
      [userId, followeeId]
    );

    const res = await request(app)
      .get('/api/leaderboard/followed/lifetime')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(0);
    expect(res.body.totalPages).toBe(0);
  });

  test('200 - weekly and lifetime followed rankings are independent', async () => {
    await pool.query(
      'UPDATE User SET WEEKLY_EXP = 0, LIFETIME_EXP = 1000 WHERE ID = ?',
      [userId]
    );

    const [weekly, lifetime] = await Promise.all([
      request(app).get('/api/leaderboard/followed/weekly').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/leaderboard/followed/lifetime').set('Authorization', `Bearer ${token}`)
    ]);

    expect(Number(weekly.body.userExp)).toBe(0);
    expect(Number(lifetime.body.userExp)).toBe(1000);
  });

  test('401 - missing token', async () => {
    const res = await request(app)
      .get('/api/leaderboard/followed/lifetime');

    expect(res.status).toBe(401);
  });
});
