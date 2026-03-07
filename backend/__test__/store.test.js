////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          store.test.js
//  Description:   Integration tests for store routes:
//                 GET /api/store
//                 POST /api/store/:id/purchase
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 itemConfig
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const { TEST_USER, getAuthToken, verifyTestDatabase } = require('./testHelpers');
const { ITEM_TYPES } = require('../../shared/itemConfig');

let token;
let userId;

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');
  await pool.query('DELETE FROM StoreItem');

  token = await getAuthToken();

  const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  userId = rows[0].ID;
});

afterEach(async () => {
  await pool.query('DELETE FROM StoreItem'); // Cascades to Purchase
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error('Error closing pool in store.test.js:', err);
  }
});

// Test fetching store items
describe('GET /api/store', () => {

  test('200 - returns empty array when no items', async () => {
    const res = await request(app)
      .get('/api/store')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body.items).toHaveLength(0);
  });

  test('200 - returns all store items', async () => {
    // Add a new flair and profile picture
    await pool.query('INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)', [ITEM_TYPES.FLAIR, 5.00, 'Test Flair']);
    await pool.query('INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)', [ITEM_TYPES.PROFILE_PICTURE, 100.00, 'Duke']);

    const res = await request(app)
      .get('/api/store')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toHaveProperty('ID');
    expect(res.body.items[0]).toHaveProperty('TYPE');
    expect(res.body.items[0]).toHaveProperty('COST');
    expect(res.body.items[0]).toHaveProperty('NAME');
  });

  test('401 - no auth token', async () => {
    const res = await request(app).get('/api/store');
    expect(res.status).toBe(401);
  });
});

// Test purchasing items
describe('POST /api/store/:id/purchase', () => {

  test('200 - successfully purchases item and decrements coins', async () => {
    // Give user enough coins
    await pool.query('UPDATE User SET COINS = 100 WHERE ID = ?', [userId]);

    // Add new flair
    const [result] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)',
      [ITEM_TYPES.FLAIR, 5.00, 'Test Flair']
    );
    const itemId = result.insertId;

    // Have user purchase the flair
    const res = await request(app)
      .post(`/api/store/${itemId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify purchase row was inserted
    const [purchases] = await pool.query('SELECT * FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?', [userId, itemId]);
    expect(purchases).toHaveLength(1);
    expect(purchases[0].IS_EQUIPPED).toBe(0);

    // Verify coins were decremented
    const [users] = await pool.query('SELECT COINS FROM User WHERE ID = ?', [userId]);
    expect(parseFloat(users[0].COINS)).toBe(95);
  });

  test('400 - invalid item ID', async () => {
    const res = await request(app)
      .post('/api/store/abc/purchase')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('400 - insufficient coins', async () => {
    await pool.query('UPDATE User SET COINS = 0 WHERE ID = ?', [userId]);

    const [result] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)',
      [ITEM_TYPES.FLAIR, 5.00, 'Expensive Flair']
    );

    // Try to buy, but not enough coins!
    const res = await request(app)
      .post(`/api/store/${result.insertId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app).post('/api/store/1/purchase');
    expect(res.status).toBe(401);
  });

  test('404 - item not found', async () => {
    const res = await request(app)
      .post('/api/store/999999/purchase')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('409 - item already purchased', async () => {
    await pool.query('UPDATE User SET COINS = 100 WHERE ID = ?', [userId]);

    const [result] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)',
      [ITEM_TYPES.FLAIR, 5.00, 'Test Flair']
    );
    const itemId = result.insertId;

    // Purchase once
    await request(app)
      .post(`/api/store/${itemId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    // Try to purchase again
    const res = await request(app)
      .post(`/api/store/${itemId}/purchase`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});
