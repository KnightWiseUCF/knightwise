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
//                 paginationConfig (mocked)
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const { TEST_USER, getAuthToken, verifyTestDatabase, insertPurchase, insertUser } = require('./testHelpers');
const { ITEM_TYPES, EQUIP_LIMITS } = require('../../shared/itemConfig');

// Mock Discord webhook
const { notifyUserEvent } = require('../services/discordWebhook');
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

// Mock paginationConfig to a small page size for pagination tests
const { PAGE_SIZES } = require('../config/paginationConfig'); 
jest.mock('../config/paginationConfig', () => ({
  PAGE_SIZES: {
    LEADERBOARD: 50,
    USER_SEARCH: 2, // So we don't have to insert a bunch of users
  }
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

// Test user following
describe('POST /api/users/:id/follow', () => {

  test('200 - successfully follows existing, currently unfollowed user', async () => {
    // Insert generic user to follow
    const followeeId = await insertUser();

    // Follow
    const res = await request(app)
      .post(`/api/users/${followeeId}/follow`)
      .set('Authorization', `Bearer ${token}`);

    // Verify successful follow and creation of the following relationship
    expect(res.status).toBe(200);
    const [follows] = await pool.query(
      'SELECT FOLLOWER_ID, FOLLOWING_ID FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
      [userId, followeeId]
    );
    expect(follows.length).toBe(1);

    // Cleanup generic user we inserted (cascades to follow)
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('400 - cannot follow a user that you are already following', async () => {
    // Insert generic user to follow
    const followeeId = await insertUser();

    // Insert following relationship
    await pool.query(
      'INSERT INTO Follower (FOLLOWER_ID, FOLLOWING_ID) VALUES (?, ?)',
      [userId, followeeId]
    );

    // Try to follow again
    const res = await request(app)
      .post(`/api/users/${followeeId}/follow`)
      .set('Authorization', `Bearer ${token}`);

    // Failed
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User is already followed.');

    // Cleanup generic user we inserted (cascades to follow)
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('400 - cannot follow invalid user ID', async () => {
    const res = await request(app)
      .post('/api/users/abc/follow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid user ID');
  });

  test('400 - user cannot follow themselves', async () => {
    const res = await request(app)
      .post(`/api/users/${userId}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User cannot follow themselves.');
  });

  test('404 - cannot follow non-existent user ID', async () => {
    const res = await request(app)
      .post(`/api/users/999/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .post(`/api/users/999/follow`);

    expect(res.status).toBe(401);
  });
});

// Test user unfollowing
describe('DELETE /api/users/:id/follow', () => {

  test('200 - successfully unfollows existing, currently followed user', async () => {
    // Insert generic user to follow
    const followeeId = await insertUser();

    // Insert follow relationship
    await pool.query(
      'INSERT INTO Follower (FOLLOWER_ID, FOLLOWING_ID) VALUES (?, ?)',
      [userId, followeeId]
    );

    // Now unfollow
    const res = await request(app)
      .delete(`/api/users/${followeeId}/follow`)
      .set('Authorization', `Bearer ${token}`);

    // Verify successful unfollow and deletion of the following relationship
    expect(res.status).toBe(200);
    const [unfollows] = await pool.query(
      'SELECT FOLLOWER_ID, FOLLOWING_ID FROM Follower WHERE FOLLOWER_ID = ? AND FOLLOWING_ID = ?',
      [userId, followeeId]
    );
    expect(unfollows.length).toBe(0);

    // Cleanup generic user we inserted (cascades to follow)
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('400 - cannot unfollow a user that you are not already following', async () => {
    // Insert generic user, but we don't follow them
    const followeeId = await insertUser();

    // Try to unfollow
    const res = await request(app)
      .delete(`/api/users/${followeeId}/follow`)
      .set('Authorization', `Bearer ${token}`);

    // Failed
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User is not followed.');

    // Cleanup generic user we inserted (cascades to follow)
    await pool.query('DELETE FROM User WHERE ID = ?', [followeeId]);
  });

  test('400 - cannot unfollow invalid user ID', async () => {
    const res = await request(app)
      .delete('/api/users/abc/follow')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid user ID');
  });

  test('404 - cannot unfollow non-existent user ID', async () => {
    const res = await request(app)
      .delete(`/api/users/999/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .delete(`/api/users/999/follow`);

    expect(res.status).toBe(401);
  });
});

// Test user searching
describe('GET /api/users/search', () => {

  let searchUserIds = [];

  beforeAll(async () => {
    // Insert 3 users with "knight" in the username, enough to spill onto page 2 with PAGE_SIZE mocked to 2
    searchUserIds.push(await insertUser({ username: 'knightking',  firstName: 'Arthur',   lastName: 'Pendragon', email: 'arthur@gmail.com' }));
    searchUserIds.push(await insertUser({ username: 'knightmare',  firstName: 'Bors',     lastName: 'Ganis'    , email: 'bors@hotmail.com' }));
    searchUserIds.push(await insertUser({ username: 'knightrider', firstName: 'Lancelot', lastName: 'Du Lac'   , email: 'lancelot@cs.com'  }));
    searchUserIds.push(await insertUser({ username: 'roundtable',  firstName: 'Gawain',   lastName: 'Orkney'   , email: 'gawain@aol.com' }));
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM User WHERE ID IN (${searchUserIds.map(() => '?').join(',')})`,
      searchUserIds
    );
  });

  test('200 - partial match returns matching users', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knight')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const usernames = res.body.users.map(u => u.USERNAME);
    expect(usernames).toContain('knightking');
    expect(usernames).not.toContain('roundtable');
  });

  test('200 - search is case insensitive', async () => {
    const res = await request(app)
      .get('/api/users/search?username=KNIGHT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const usernames = res.body.users.map(u => u.USERNAME);
    expect(usernames).toContain('knightking');
    expect(usernames).toContain('knightmare');
  });

  test('200 - empty username returns all users', async () => {
    const res = await request(app)
      .get('/api/users/search?username=')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  test('200 - no username param returns all users', async () => {
    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  test('200 - no match returns empty list, not error', async () => {
    const res = await request(app)
      .get('/api/users/search?username=zzznomatchzzz')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
    expect(res.body.pagination.totalUsers).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });

  test('200 - response includes expected user fields', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knightking')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    const user = res.body.users[0];
    expect(user).toHaveProperty('ID');
    expect(user).toHaveProperty('USERNAME', 'knightking');
    expect(user).toHaveProperty('FIRSTNAME');
    expect(user).toHaveProperty('LASTNAME');
  });

  test('200 - does not expose sensitive fields', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knightking')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const user = res.body.users[0];
    expect(user).not.toHaveProperty('PASSWORD');
    expect(user).not.toHaveProperty('EMAIL');
    expect(user).not.toHaveProperty('COINS');
  });

  test('200 - pagination metadata present and correct on page 1', async () => {
    // 3 knight users, page size mocked to 2
    // So we'll have first page with 2 users and second page with 1
    const res = await request(app)
      .get('/api/users/search?username=knight&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('page', 1);
    expect(res.body.pagination).toHaveProperty('pageSize', 2);
    expect(res.body.pagination).toHaveProperty('totalUsers', 3);
    expect(res.body.pagination).toHaveProperty('totalPages', 2);
    expect(res.body.users).toHaveLength(2); // Page 1 full
  });

  test('200 - page 2 returns remaining results', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knight&page=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.users).toHaveLength(1); // Only 1 user with "knight" left on page 2
  });

  test('200 - invalid page clamps to 1', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knight&page=abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('200 - out of range page clamps to last page', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knight&page=99999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(res.body.pagination.totalPages);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/users/search?username=knight');

    expect(res.status).toBe(401);
  });
});

// Test stats opt-in toggle
describe('PUT /api/users/:id/stats-opt-in', () => {

  test('200 - successfully enables stats sharing', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('optIn', true);

    const [rows] = await pool.query('SELECT IS_SHARING_STATS FROM User WHERE ID = ?', [userId]);
    expect(rows[0].IS_SHARING_STATS).toBe(1);
  });

  test('200 - successfully disables stats sharing', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: false });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('optIn', false);

    const [rows] = await pool.query('SELECT IS_SHARING_STATS FROM User WHERE ID = ?', [userId]);
    expect(rows[0].IS_SHARING_STATS).toBe(0);
  });

  test('200 - setting same value twice leaves it unchanged', async () => {
    await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    // Set it true again
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    // Still true
    expect(res.status).toBe(200);
    const [rows] = await pool.query('SELECT IS_SHARING_STATS FROM User WHERE ID = ?', [userId]);
    expect(rows[0].IS_SHARING_STATS).toBe(1);
  });

  test('400 - rejects non-boolean optIn', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: 'yes' });

    expect(res.status).toBe(400);
  });

  test('400 - rejects missing optIn field', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 - invalid user ID', async () => {
    const res = await request(app)
      .put('/api/users/abc/stats-opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .send({ optIn: true });

    expect(res.status).toBe(401);
  });

  test('403 - cannot update another user', async () => {
    const res = await request(app)
      .put('/api/users/999999/stats-opt-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    expect(res.status).toBe(403);
  });

  test('404 - user not found', async () => {
    // Delete user
    await pool.query('DELETE FROM User WHERE ID = ?', [userId]);

    const res = await request(app)
      .put(`/api/users/${userId}/stats-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optIn: true });

    expect(res.status).toBe(404);

    // Add user back for any future tests
    token = await getAuthToken();
    const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
    userId = rows[0].ID;
  });
});
