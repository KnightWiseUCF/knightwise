////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          user.test.js
//  Description:   Integration tests for user routes:
//                 GET /api/users/:id
//                 PUT /api/users/:id
//                 DELETE /api/users/:id
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 discordWebhook (mocked)
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const { TEST_USER, getAuthToken, verifyTestDatabase, insertPurchase } = require('./testHelpers');
const { ITEM_TYPES, EQUIP_LIMITS } = require('../../shared/itemConfig');

// Mock Discord webhook
const { notifyUserEvent } = require('../services/discordWebhook');
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

let token;
let userId;

// Test setup/teardown
beforeAll(async () => {
  await verifyTestDatabase(pool);

  // Preliminary cleanup
  await pool.query("DELETE FROM User");

  // Add test user to test database
  token = await getAuthToken();

  // Fetch test user's ID for use in route params
  const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  userId = rows[0].ID;
});

beforeEach(async () => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await pool.query("DELETE FROM User");
  try 
  {
    await pool.end();
  } 
  catch (err) 
  {
    console.error("Error closing pool in /users unit test:", err);
  }
});

// Test fetching user info
describe('GET /api/users/:id', () => {

  test('200 - returns user info and equipped items', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('equippedItems');
    expect(res.body.user).toHaveProperty('ID', userId);
    expect(res.body.user).toHaveProperty('USERNAME', TEST_USER.username);
    expect(res.body.user).toHaveProperty('LIFETIME_EXP');
    expect(res.body.user).toHaveProperty('WEEKLY_EXP');
    expect(res.body.user).toHaveProperty('COINS');
    expect(Array.isArray(res.body.equippedItems)).toBe(true);
  });

  test('200 - returns equipped items for user', async () => {
    const itemType = ITEM_TYPES.PROFILE_PICTURE;
    const itemCost = '100.00';
    const itemName = 'Octocat';

    // The true at the end equips the item
    const itemId = await insertPurchase(userId, { type: itemType, cost: itemCost, name: itemName }, true);
    // Purchase but don't equip this one
    const uneqippedId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, cost: '3.00', name: 'notEquippedThing' }, false);

    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.equippedItems).toHaveLength(1); // Shows only the one we equipped!
    expect(res.body.equippedItems[0]).toHaveProperty('ID', itemId);
    expect(res.body.equippedItems[0]).toHaveProperty('TYPE', itemType);
    expect(res.body.equippedItems[0]).toHaveProperty('COST', itemCost);
    expect(res.body.equippedItems[0]).toHaveProperty('NAME', itemName);

    // Cleanup, cascades to purchase
    await pool.query('DELETE FROM StoreItem WHERE ID IN (?, ?)', [itemId, uneqippedId]);
  });

  test('200 - does not expose sensitive fields', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty('PASSWORD');
    expect(res.body.user).not.toHaveProperty('EMAIL');
  });

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .get('/api/users/abc') // NaN
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('400 - non-positive user ID', async () => {
    const res = await request(app)
      .get('/api/users/-1') // Negative
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`);

    expect(res.status).toBe(401);
  });

  test('404 - user not found', async () => {
    const res = await request(app)
      .get('/api/users/999999') // Non-existent
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

});

// Test updating user info
describe('PUT /api/users/:id', () => {

  test('200 - successfully updates first and last name', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Jean-Jacques', newLastName: "O'Malley" }); // Should allow dash and apostrophe

    expect(res.status).toBe(200);

    // Verify webhook notification sent
    expect(notifyUserEvent).toHaveBeenCalledTimes(1);
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining(`${userId}`)
    );

    // Verify change actually happened
    const [rows] = await pool.query('SELECT FIRSTNAME, LASTNAME FROM User WHERE ID = ?', [userId]);
    expect(rows[0].FIRSTNAME).toBe('Jean-Jacques');
    expect(rows[0].LASTNAME).toBe("O'Malley");
  });

  test('200 - accepts names with periods (e.g. Jr.)', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Martin Luther', newLastName: 'King Jr.' });

    expect(res.status).toBe(200);
  });

  test('200 - accepts accented/non-English characters', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'René', newLastName: 'Müller' });

    expect(res.status).toBe(200);
  });

  test('400 - rejects numbers in first name', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Test123', newLastName: 'User' });

    expect(res.status).toBe(400);
  });

  test('400 - rejects empty first name', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: '', newLastName: 'User' });

    expect(res.status).toBe(400);
  });

  test('400 - rejects missing name fields', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .put('/api/users/abc') // Again, NaN
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Test', newLastName: 'User' });

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .send({ newFirstName: 'Test', newLastName: 'User' });

    expect(res.status).toBe(401);
  });

  test('403 - cannot update another user', async () => {
    const res = await request(app)
      .put('/api/users/999999') // Doesn't exist anyway, but you get the point
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Test', newLastName: 'User' });

    expect(res.status).toBe(403);
  });

  test('404 - user not found', async () => {
    // 404 reachable only if user somehow disappears between auth and query
    await pool.query('DELETE FROM User WHERE ID = ?', [userId]);

    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newFirstName: 'Test', newLastName: 'User' });

    expect(res.status).toBe(404);

    // Let's add the user back for the other tests...
    token = await getAuthToken();
    const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
    userId = rows[0].ID;
  });

});

// Test deleting user
describe('DELETE /api/users/:id', () => {

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .delete('/api/users/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .delete(`/api/users/${userId}`);

    expect(res.status).toBe(401);
  });

  test('403 - cannot delete another user', async () => {
    const res = await request(app)
      .delete('/api/users/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
  
  test('404 - user not found', async () => {
    // 404 reachable only if user somehow disappears between auth and query
    await pool.query('DELETE FROM User WHERE ID = ?', [userId]);

    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);

    // Add test user back
    token = await getAuthToken();
    const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
    userId = rows[0].ID;
  });

  test('200 - successfully deletes own account', async () => {
    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Account deleted successfully');

    // Verify webhook notifcation sent
    expect(notifyUserEvent).toHaveBeenCalledTimes(1);
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining(TEST_USER.username)
    );

    // Verify user is gone
    const [rows] = await pool.query('SELECT ID FROM User WHERE ID = ?', [userId]);
    expect(rows.length).toBe(0);

     // Re-create user for other tests
    token = await getAuthToken();
    const [newUserRows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
    userId = newUserRows[0].ID;
  });
});

// Test equipping items
describe('PUT /api/users/:id/equip', () => {

  test('200 - successfully equips a purchased item', async () => {
    const itemId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: 'Test Flair' }, false);

    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(200);

    // Verify equip state actually changed
    const [rows] = await pool.query('SELECT IS_EQUIPPED FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?', [userId, itemId]);
    expect(rows[0].IS_EQUIPPED).toBe(1);

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('400 - item already equipped', async () => {
    // Insert purchase and equip
    const itemId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: 'Test Flair' }, true);

    // Try equipping same item
    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(400);

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .put('/api/users/abc/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 1 });

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .send({ itemId: 1 });

    expect(res.status).toBe(401);
  });

  test('403 - cannot equip for another user', async () => {
    const res = await request(app)
      .put('/api/users/999999/equip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 1 });

    expect(res.status).toBe(403);
  });

  test('404 - item not purchased', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 999999 });

    expect(res.status).toBe(404);
  });

  test('409 - equip limit reached for flairs', async () => {
    // Insert and equip max # of flairs
    const itemIds = [];
    for (let i = 0; i < EQUIP_LIMITS[ITEM_TYPES.FLAIR]; i++)
    {
      itemIds.push(await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: `Flair ${i}` }, true));
    }
    // One more flair, unequipped
    const extraItemId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: 'Extra Flair' }, false);
    itemIds.push(extraItemId);

    // Now try to equip it
    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: extraItemId });

    // Equip limit reached!
    expect(res.status).toBe(409);

    // Cleanup
    await pool.query(`DELETE FROM StoreItem WHERE ID IN (${itemIds.map(() => '?').join(',')})`, itemIds);
  });

  test('200 - equipping profile picture swaps out current one', async () => {
    // Insert and equip 1 profile picture (the limit)
    const pfpId1 = await insertPurchase(userId, { type: ITEM_TYPES.PROFILE_PICTURE, name: 'Pic 1' }, true);
    // This one has been purchased but not equipped
    const pfpId2 = await insertPurchase(userId, { type: ITEM_TYPES.PROFILE_PICTURE, name: 'Pic 2' }, false);

    // Equip the second picture, it should just swap out the first one
    const res = await request(app)
      .put(`/api/users/${userId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: pfpId2 });

    expect(res.status).toBe(200);

    // Verify old picture was unequipped
    const [old] = await pool.query('SELECT IS_EQUIPPED FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?', [userId, pfpId1]);
    expect(old[0].IS_EQUIPPED).toBe(0);

    // Verify new picture is equipped
    const [current] = await pool.query('SELECT IS_EQUIPPED FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?', [userId, pfpId2]);
    expect(current[0].IS_EQUIPPED).toBe(1);

    await pool.query('DELETE FROM StoreItem WHERE ID IN (?, ?)', [pfpId1, pfpId2]);
  });
});

// Test unequipping items
describe('PUT /api/users/:id/unequip', () => {

  test('200 - successfully unequips an equipped item', async () => {
    // Purchase and equip a flair
    const itemId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: 'Test Flair' }, true);

    // Try to unequip it
    const res = await request(app)
      .put(`/api/users/${userId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    // Success!
    expect(res.status).toBe(200);

    // Verify equip state actually changed to false
    const [rows] = await pool.query('SELECT IS_EQUIPPED FROM Purchase WHERE USER_ID = ? AND ITEM_ID = ?', [userId, itemId]);
    expect(rows[0].IS_EQUIPPED).toBe(0);

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('400 - item not equipped', async () => {
    // Insert purchase as unequipped
    const itemId = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, name: 'Test Flair' }, false);

    // Try double-unequipping
    const res = await request(app)
      .put(`/api/users/${userId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(400);

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/unequip`)
      .send({ itemId: 1 });

    expect(res.status).toBe(401);
  });

  test('403 - cannot unequip for another user', async () => {
    const res = await request(app)
      .put('/api/users/999999/unequip')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 1 });

    expect(res.status).toBe(403);
  });

  test('404 - item not purchased', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 999999 });

    expect(res.status).toBe(404);
  });
});

// Test fetching user purchases
describe('GET /api/users/:id/purchases', () => {

  test('200 - returns empty array when no purchases', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/purchases`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('purchases');
    expect(res.body.purchases).toHaveLength(0);
  });

  test('200 - returns purchased items with item data', async () => {
    // Insert two purchases
    const itemId1 = await insertPurchase(userId, { type: ITEM_TYPES.FLAIR, cost: '5.00', name: 'Test Flair' }, false);
    const itemId2 = await insertPurchase(userId, { type: ITEM_TYPES.PROFILE_PICTURE, cost: '10.00', name: 'Test Pic' }, true);

    const res = await request(app)
      .get(`/api/users/${userId}/purchases`)
      .set('Authorization', `Bearer ${token}`);

    const flair = res.body.purchases.find(p => p.ID === itemId1);
    const pic   = res.body.purchases.find(p => p.ID === itemId2);

    // Should succeed and show purchases
    expect(res.status).toBe(200);
    expect(res.body.purchases).toHaveLength(2);
    expect(flair).toHaveProperty('ID',  itemId1);
    expect(flair).toHaveProperty('TYPE', ITEM_TYPES.FLAIR);
    expect(flair).toHaveProperty('COST', '5.00');
    expect(flair).toHaveProperty('NAME', 'Test Flair');
    expect(flair).toHaveProperty('IS_EQUIPPED', 0);
    expect(pic).toHaveProperty('ID', itemId2);
    expect(pic).toHaveProperty('TYPE', ITEM_TYPES.PROFILE_PICTURE);
    expect(pic).toHaveProperty('COST', '10.00');
    expect(pic).toHaveProperty('NAME', 'Test Pic');
    expect(pic).toHaveProperty('IS_EQUIPPED', 1);

    // Cleanup
    await pool.query('DELETE FROM StoreItem WHERE ID IN (?, ?)', [itemId1, itemId2]);
  });

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .get('/api/users/abc/purchases')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/purchases`);

    expect(res.status).toBe(401);
  });
});
