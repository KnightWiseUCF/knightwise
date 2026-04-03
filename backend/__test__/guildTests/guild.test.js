////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guild.test.js
//  Description:   Integration tests for guild core operations:
//                 POST   /api/guilds
//                 DELETE /api/guilds/:id
//                 GET    /api/guilds/:id
//                 POST   /api/guilds/:id/contribute
//                 DELETE /api/guilds/:id/members/:userId
//                 PATCH  /api/guilds/:id/members/:userId/role
//                 PUT    /api/guilds/:id/equip
//                 PUT    /api/guilds/:id/unequip
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 discordWebhook (mocked)
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
        getValidGuildName,
      } = require('../testHelpers');

// Mock Discord webhook
const { notifyUserEvent } = require('../../services/discordWebhook');
jest.mock('../../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent:  jest.fn().mockResolvedValue(true),
  notifyError:      jest.fn().mockResolvedValue(true),
}));

let token;
let userId;

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');

  token  = await getAuthToken();
  const [rows] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  userId = rows[0].ID;
});

beforeEach(async () => {
  jest.clearAllMocks();
  // Clean guild state between tests
  await pool.query('DELETE FROM Guild');
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try { await pool.end(); }
  catch (err) { console.error('Error closing pool in guild.test.js:', err); }
});

// Test guild creation
describe('POST /api/guilds', () => {

  test('201 - successfully creates guild and inserts owner as member', async () => {
    // Get valid name and name token
    const { name, nameToken } = await getValidGuildName(token);
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, nameToken });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('guildId');
    expect(res.body).toHaveProperty('name');
    expect(res.body.name).toBe(name);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('successfully');

    // Verify guild row exists
    const [guilds] = await pool.query('SELECT * FROM Guild WHERE ID = ?', [res.body.guildId]);
    expect(guilds).toHaveLength(1);
    expect(guilds[0].NAME).toBe(name);

    // Verify owner member row exists
    const [members] = await pool.query(
      'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, res.body.guildId]
    );
    expect(members).toHaveLength(1);
    expect(members[0].ROLE).toBe('Owner');
  });

  test('201 - notifies Discord on guild creation', async () => {
    // Get valid name and name token
    const { name, nameToken } = await getValidGuildName(token);
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, nameToken });

    expect(res.status).toBe(201);
    expect(notifyUserEvent).toHaveBeenCalledTimes(1);
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining('Guild created')
    );
  });

  test('400 - missing guild name', async () => {
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('400 - empty guild name', async () => {
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  test('400 - missing nameToken', async () => {
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ancient Wolves' }); // Can't give arbitrary names anymore!

    expect(res.status).toBe(400);
  });

  test('401 - rejects tampered nameToken', async () => {
    // Get valid name and name token
    const { name, nameToken } = await getValidGuildName(token);

    // Lets mess with the JWT a little bit
    const badNameToken = nameToken.slice(0, -1) + 'x';

    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, nameToken: badNameToken });

    expect(res.status).toBe(400);
  });

  test('400 - name does not match token payload', async () => {
    // Get valid name and name token
    const { name, nameToken } = await getValidGuildName(token);

    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Evil Name', nameToken });

    expect(res.status).toBe(400);
  });

  test('409 - user already in a guild', async () => {
    await insertGuildWithOwner(userId, { name: 'First Guild' });

    // Get valid name and name token for second guild
    const { name, nameToken } = await getValidGuildName(token);
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, nameToken });

    expect(res.status).toBe(409);
  });

  test('409 - guild name already taken', async () => {
    // Get valid name and name token
    const { name, nameToken } = await getValidGuildName(token);

    // But wait, another user somehow gets that name first
    // (technically a possible race condition)
    const otherId = await insertUser({ username: 'otherown', email: 'otherown@test.com' });
    await insertGuildWithOwner(otherId, { name });

    // TEST_USER can't get the name now
    const res = await request(app)
      .post('/api/guilds')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, nameToken });

    expect(res.status).toBe(409);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .post('/api/guilds')
      .send({ name: 'Test Guild' });

    expect(res.status).toBe(401);
  });
});

// Test guild deletion
describe('DELETE /api/guilds/:id', () => {

  test('200 - owner can delete their guild', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Doomed Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const [guilds] = await pool.query('SELECT ID FROM Guild WHERE ID = ?', [guildId]);
    expect(guilds).toHaveLength(0);
  });

  test('notifies Discord on guild deletion', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Webhook Delete Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(notifyUserEvent).toHaveBeenCalledTimes(1);
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining('Guild deleted')
    );
  });

  test('403 - officer cannot delete guild', async () => {
    const ownerId = await insertUser({ username: 'guildowner', email: 'guildowner@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Sturdy Guild' });
    await insertGuildMember(userId, guildId, 'Officer');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('403 - member cannot delete guild', async () => {
    const ownerId = await insertUser({ username: 'guildowner2', email: 'guildowner2@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Sturdy Guild 2' });
    await insertGuildMember(userId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('400 - invalid guild ID', async () => {
    const res = await request(app)
      .delete('/api/guilds/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('404 - guild not found', async () => {
    const res = await request(app)
      .delete('/api/guilds/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Ghost Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}`);

    expect(res.status).toBe(401);
  });
});

// Test fetching guild info
describe('GET /api/guilds/:id', () => {

  test('200 - returns guild info and equipped items', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Info Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('guild');
    expect(res.body).toHaveProperty('equippedItems');
    expect(res.body.guild).toHaveProperty('ID', guildId);
    expect(res.body.guild).toHaveProperty('NAME', 'Info Guild');
    expect(Array.isArray(res.body.equippedItems)).toBe(true);
  });

  test('200 - equippedItems is empty when nothing equipped', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Empty Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.equippedItems).toHaveLength(0);
  });

  test('400 - invalid guild ID', async () => {
    const res = await request(app)
      .get('/api/guilds/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('404 - guild not found', async () => {
    const res = await request(app)
      .get('/api/guilds/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Secret Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}`);

    expect(res.status).toBe(401);
  });
});

// Test user coin contribution to guild
describe('POST /api/guilds/:id/contribute', () => {

  test('200 - member can contribute coins', async () => {
    await pool.query('UPDATE User SET COINS = 500 WHERE ID = ?', [userId]);
    const guildId = await insertGuildWithOwner(userId, { name: 'Rich Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('coinBank');
    expect(res.body).toHaveProperty('newlyUnlocked');

    // Verify user coins decremented
    const [[user]] = await pool.query('SELECT COINS FROM User WHERE ID = ?', [userId]);
    expect(user.COINS).toBe(400);

    // Verify guild bank incremented
    const [[guild]] = await pool.query('SELECT COINS FROM Guild WHERE ID = ?', [guildId]);
    expect(guild.COINS).toBe(100);
  });

  test('200 - auto-unlocks items when threshold met', async () => {
    await pool.query('UPDATE User SET COINS = 1000 WHERE ID = ?', [userId]);
    const guildId = await insertGuildWithOwner(userId, { name: 'Unlock Guild' });

    // Insert a guild item with cost 100
    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 100, 'Guild Flair']
    );
    const itemId = itemResult.insertId;

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.newlyUnlocked).toHaveLength(1);
    expect(res.body.newlyUnlocked[0]).toHaveProperty('id', itemId);

    // Verify GuildUnlock row created
    const [unlocks] = await pool.query(
      'SELECT * FROM GuildUnlock WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, itemId]
    );
    expect(unlocks).toHaveLength(1);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('200 - does not re-unlock already unlocked items', async () => {
    await pool.query('UPDATE User SET COINS = 1000 WHERE ID = ?', [userId]);
    const guildId = await insertGuildWithOwner(userId, { name: 'Double Unlock Guild' });

    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 50, 'Already Unlocked Flair']
    );
    const itemId = itemResult.insertId;

    // Pre-unlock the item
    await pool.query(
      'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
      [guildId, itemId]
    );

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.newlyUnlocked).toHaveLength(0);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('400 - insufficient coins', async () => {
    await pool.query('UPDATE User SET COINS = 10 WHERE ID = ?', [userId]);
    const guildId = await insertGuildWithOwner(userId, { name: 'Poor Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
  });

  test('400 - invalid amount', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Amount Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -50 });

    expect(res.status).toBe(400);
  });

  test('403 - non-member cannot contribute', async () => {
    const ownerId = await insertUser({ username: 'contrib_owner', email: 'contrib_owner@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Other Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10 });

    expect(res.status).toBe(403);
  });

  test('401 - no auth token', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Token Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/contribute`)
      .send({ amount: 10 });

    expect(res.status).toBe(401);
  });
});

// Test kicking users from guild
describe('DELETE /api/guilds/:id/members/:userId', () => {

  test('200 - owner can kick a member', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Kick Guild' });
    const memberId = await insertUser({ username: 'kickme', email: 'kickme@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const [rows] = await pool.query(
      'SELECT * FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [memberId, guildId]
    );
    expect(rows).toHaveLength(0);
  });

  test('200 - owner can kick an officer', async () => {
    const guildId    = await insertGuildWithOwner(userId, { name: 'Kick Officer Guild' });
    const officerId  = await insertUser({ username: 'kickofficer', email: 'kickofficer@test.com' });
    await insertGuildMember(officerId, guildId, 'Officer');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${officerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('200 - officer can kick a member', async () => {
    const ownerId   = await insertUser({ username: 'kickown', email: 'kickown@test.com' });
    const guildId   = await insertGuildWithOwner(ownerId, { name: 'Officer Kick Guild' });
    const officerId = userId;
    await insertGuildMember(officerId, guildId, 'Officer');
    const memberId  = await insertUser({ username: 'offkickme', email: 'offkickme@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${memberId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('400 - owner cannot kick themselves', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Self Kick Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('403 - officer cannot kick another officer', async () => {
    const ownerId    = await insertUser({ username: 'offkickown', email: 'offkickown@test.com' });
    const guildId    = await insertGuildWithOwner(ownerId, { name: 'Officer vs Officer Guild' });
    await insertGuildMember(userId, guildId, 'Officer');
    const officer2Id = await insertUser({ username: 'officer2', email: 'officer2@test.com' });
    await insertGuildMember(officer2Id, guildId, 'Officer');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${officer2Id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('403 - member cannot kick anyone', async () => {
    const ownerId   = await insertUser({ username: 'memkickown', email: 'memkickown@test.com' });
    const guildId   = await insertGuildWithOwner(ownerId, { name: 'Member Kick Guild' });
    await insertGuildMember(userId, guildId, 'Member');
    const target    = await insertUser({ username: 'memkicktgt', email: 'memkicktgt@test.com' });
    await insertGuildMember(target, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${target}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('404 - target not a member', async () => {
    const guildId    = await insertGuildWithOwner(userId, { name: 'Not Member Guild' });
    const nonMember  = await insertUser({ username: 'nonmember', email: 'nonmember@test.com' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${nonMember}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Auth Kick Guild' });
    const memberId = await insertUser({ username: 'authmember', email: 'authmember@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/members/${memberId}`);

    expect(res.status).toBe(401);
  });
});

// Test guild member promotion and demotion
describe('PATCH /api/guilds/:id/members/:userId/role', () => {

  test('200 - owner can promote member to officer', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Promote Guild' });
    const memberId = await insertUser({ username: 'promoteme', email: 'promoteme@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${memberId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Officer' });

    expect(res.status).toBe(200);

    const [[row]] = await pool.query(
      'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [memberId, guildId]
    );
    expect(row.ROLE).toBe('Officer');
  });

  test('200 - owner can demote officer to member', async () => {
    const guildId    = await insertGuildWithOwner(userId, { name: 'Demote Guild' });
    const officerId  = await insertUser({ username: 'demoteme', email: 'demoteme@test.com' });
    await insertGuildMember(officerId, guildId, 'Officer');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${officerId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Member' });

    expect(res.status).toBe(200);

    const [[row]] = await pool.query(
      'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [officerId, guildId]
    );
    expect(row.ROLE).toBe('Member');
  });

  test('200 - officer can promote member to officer', async () => {
    const ownerId  = await insertUser({ username: 'roleown', email: 'roleown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Officer Promote Guild' });
    await insertGuildMember(userId, guildId, 'Officer');
    const memberId = await insertUser({ username: 'offpromoteme', email: 'offpromoteme@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${memberId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Officer' });

    expect(res.status).toBe(200);
  });

  test('403 - officer cannot demote another officer', async () => {
    const ownerId   = await insertUser({ username: 'roleown2', email: 'roleown2@test.com' });
    const guildId   = await insertGuildWithOwner(ownerId, { name: 'Officer Demote Guild' });
    await insertGuildMember(userId, guildId, 'Officer');
    const officer2  = await insertUser({ username: 'officer2d', email: 'officer2d@test.com' });
    await insertGuildMember(officer2, guildId, 'Officer');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${officer2}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Member' });

    expect(res.status).toBe(403);
  });

  test('403 - member cannot promote or demote anyone', async () => {
    const ownerId  = await insertUser({ username: 'memroleown', email: 'memroleown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Member Role Block Guild' });
    await insertGuildMember(userId, guildId, 'Member');
    const targetId = await insertUser({ username: 'memroletgt', email: 'memroletgt@test.com' });
    await insertGuildMember(targetId, guildId, 'Member');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${targetId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Officer' });

    expect(res.status).toBe(403);
  });

  test('403 - cannot change Owner role', async () => {
    const ownerId  = await insertUser({ username: 'roleown3', email: 'roleown3@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Owner Role Guild' });
    await insertGuildMember(userId, guildId, 'Officer');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${ownerId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Member' });

    expect(res.status).toBe(403);
  });

  test('400 - invalid role value', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Bad Role Guild' });
    const memberId = await insertUser({ username: 'badrole', email: 'badrole@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${memberId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newRole: 'Supreme Commander' });

    expect(res.status).toBe(400);
  });

  test('401 - no auth token', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Auth Role Guild' });
    const memberId = await insertUser({ username: 'authrole', email: 'authrole@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/members/${memberId}/role`);

    expect(res.status).toBe(401);
  });
});

// Test guild equip/unequip
describe('PUT /api/guilds/:id/equip and unequip', () => {

  let guildId;
  let guildItemId;

  beforeEach(async () => {
    guildId = await insertGuildWithOwner(userId, { name: 'Equip Guild' });

    // Insert a guild flair item
    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 50, 'Guild Test Flair']
    );
    guildItemId = itemResult.insertId;

    // Pre-unlock it for the guild
    await pool.query(
      'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
      [guildId, guildItemId]
    );
  });

  afterEach(async () => {
    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [guildItemId]);
  });

  test('200 - officer or owner can equip an unlocked item', async () => {
    const res = await request(app)
      .put(`/api/guilds/${guildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: guildItemId });

    expect(res.status).toBe(200);

    const [[row]] = await pool.query(
      'SELECT IS_EQUIPPED FROM GuildUnlock WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, guildItemId]
    );
    expect(row.IS_EQUIPPED).toBe(1);
  });

  test('400 - cannot equip already equipped item', async () => {
    await pool.query(
      'UPDATE GuildUnlock SET IS_EQUIPPED = 1 WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, guildItemId]
    );

    const res = await request(app)
      .put(`/api/guilds/${guildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: guildItemId });

    expect(res.status).toBe(400);
  });

  test('403 - item not unlocked returns 403', async () => {
    const [lockedResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 9999, 'Locked Guild Flair']
    );
    const lockedItemId = lockedResult.insertId;

    const res = await request(app)
      .put(`/api/guilds/${guildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: lockedItemId });

    expect(res.status).toBe(403);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [lockedItemId]);
  });

  test('403 - member cannot equip', async () => {
    // Clean up any existing membership for userId before this test
    await pool.query('DELETE FROM GuildMember WHERE USER_ID = ?', [userId]);
    const ownerId = await insertUser({ username: 'equipown', email: 'equipown@test.com' });
    const memberGuildId = await insertGuildWithOwner(ownerId, { name: 'Member Equip Guild' });
    await insertGuildMember(userId, memberGuildId, 'Member');

    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 0, 'Member Equip Flair']
    );
    const itemId = itemResult.insertId;
    await pool.query(
      'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
      [memberGuildId, itemId]
    );

    const res = await request(app)
      .put(`/api/guilds/${memberGuildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(403);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('200 - equipping profile picture auto-swaps current one', async () => {
    const [pic1Result] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['profile_picture', 10, 'Guild Pic 1']
    );
    const [pic2Result] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['profile_picture', 10, 'Guild Pic 2']
    );
    const pic1Id = pic1Result.insertId;
    const pic2Id = pic2Result.insertId;

    // Unlock and equip pic1
    await pool.query('INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 1)', [guildId, pic1Id]);
    // Unlock but don't equip pic2
    await pool.query('INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)', [guildId, pic2Id]);

    const res = await request(app)
      .put(`/api/guilds/${guildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: pic2Id });

    expect(res.status).toBe(200);

    const [[old]] = await pool.query(
      'SELECT IS_EQUIPPED FROM GuildUnlock WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, pic1Id]
    );
    expect(old.IS_EQUIPPED).toBe(0);

    const [[current]] = await pool.query(
      'SELECT IS_EQUIPPED FROM GuildUnlock WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, pic2Id]
    );
    expect(current.IS_EQUIPPED).toBe(1);

    await pool.query('DELETE FROM StoreItem WHERE ID IN (?, ?)', [pic1Id, pic2Id]);
  });

  test('200 - owner can unequip an equipped item', async () => {
    await pool.query(
      'UPDATE GuildUnlock SET IS_EQUIPPED = 1 WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, guildItemId]
    );

    const res = await request(app)
      .put(`/api/guilds/${guildId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: guildItemId });

    expect(res.status).toBe(200);

    const [[row]] = await pool.query(
      'SELECT IS_EQUIPPED FROM GuildUnlock WHERE GUILD_ID = ? AND ITEM_ID = ?',
      [guildId, guildItemId]
    );
    expect(row.IS_EQUIPPED).toBe(0);
  });

  test('400 - cannot unequip item that is not equipped', async () => {
    const res = await request(app)
      .put(`/api/guilds/${guildId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: guildItemId });

    expect(res.status).toBe(400);
  });

  test('401 - no auth token on equip', async () => {
    const res = await request(app)
      .put(`/api/guilds/${guildId}/equip`)
      .send({ itemId: guildItemId });

    expect(res.status).toBe(401);
  });

  test('200 - officer can equip an unlocked item', async () => {
    // Clean up any existing membership for userId before this test
    await pool.query('DELETE FROM GuildMember WHERE USER_ID = ?', [userId]);
    const ownerId      = await insertUser({ username: 'offequipown', email: 'offequipown@test.com' });
    const offGuildId   = await insertGuildWithOwner(ownerId, { name: 'Officer Equip Guild' });
    await insertGuildMember(userId, offGuildId, 'Officer');

    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 0, 'Officer Equip Flair']
    );
    const itemId = itemResult.insertId;
    await pool.query(
      'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 0)',
      [offGuildId, itemId]
    );

    const res = await request(app)
      .put(`/api/guilds/${offGuildId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(200);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });

  test('200 - officer can unequip an equipped item', async () => {
    // Clean up any existing membership for userId before this test
    await pool.query('DELETE FROM GuildMember WHERE USER_ID = ?', [userId]);
    const ownerId      = await insertUser({ username: 'offunequipown', email: 'offunequipown@test.com' });
    const offGuildId   = await insertGuildWithOwner(ownerId, { name: 'Officer Unequip Guild' });
    await insertGuildMember(userId, offGuildId, 'Officer');

    const [itemResult] = await pool.query(
      'INSERT INTO StoreItem (TYPE, COST, NAME, IS_GUILD_ITEM) VALUES (?, ?, ?, 1)',
      ['flair', 0, 'Officer Unequip Flair']
    );
    const itemId = itemResult.insertId;
    await pool.query(
      'INSERT INTO GuildUnlock (GUILD_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, 1)',
      [offGuildId, itemId]
    );

    const res = await request(app)
      .put(`/api/guilds/${offGuildId}/unequip`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId });

    expect(res.status).toBe(200);

    await pool.query('DELETE FROM StoreItem WHERE ID = ?', [itemId]);
  });
});

// Test leaving guild
describe('DELETE /api/guilds/:id/leave', () => {

  test('200 - member can leave a guild', async () => {
    const ownerId = await insertUser({ username: 'leaveown', email: 'leaveown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Leave Member Guild' });
    await insertGuildMember(userId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/leave`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const [rows] = await pool.query(
      'SELECT * FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, guildId]
    );
    expect(rows).toHaveLength(0);
  });

  test('200 - officer can leave a guild', async () => {
    const ownerId = await insertUser({ username: 'leaveoffown', email: 'leaveoffown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Leave Officer Guild' });
    await insertGuildMember(userId, guildId, 'Officer');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/leave`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const [rows] = await pool.query(
      'SELECT * FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, guildId]
    );
    expect(rows).toHaveLength(0);
  });

  test('403 - owner cannot leave their guild', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Owner Leave Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/leave`)
      .set('Authorization', `Bearer ${token}`);

    // assertGuildRole excludes Owner, so this returns 403
    expect(res.status).toBe(403);
  });

  test('403 - non-member cannot leave a guild', async () => {
    const ownerId = await insertUser({ username: 'leavenonown', email: 'leavenonown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Non Member Leave Guild' });

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/leave`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('400 - invalid guild ID', async () => {
    const res = await request(app)
      .delete('/api/guilds/abc/leave')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('404 - guild not found', async () => {
    const res = await request(app)
      .delete('/api/guilds/999999/leave')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const ownerId = await insertUser({ username: 'leaveauthown', email: 'leaveauthown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Auth Leave Guild' });
    await insertGuildMember(userId, guildId, 'Member');

    const res = await request(app)
      .delete(`/api/guilds/${guildId}/leave`);

    expect(res.status).toBe(401);
  });
});
