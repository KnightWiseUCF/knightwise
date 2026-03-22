////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildEntry.test.js
//  Description:   Integration tests for guild invite/request flow:
//                 POST  /api/guilds/:id/invite
//                 POST  /api/guilds/:id/request
//                 PATCH /api/guilds/:id/entry/:userId
//                 GET   /api/users/me/guild-invites
//                 GET   /api/guilds/:id/requests
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 guildConfig
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
const { MAX_GUILD_SIZE } = require('../../../shared/guildConfig');

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
  await pool.query('DELETE FROM Guild');
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try { await pool.end(); }
  catch (err) { console.error('Error closing pool in guildEntry.test.js:', err); }
});

// Test guild inviting
describe('POST /api/guilds/:id/invite', () => {

  test('200 - officer can invite a user', async () => {
    const ownerId  = await insertUser({ username: 'inviteown', email: 'inviteown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Invite Guild' });
    await insertGuildMember(userId, guildId, 'Officer');
    const targetId = await insertUser({ username: 'invitetgt', email: 'invitetgt@test.com' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetId });

    expect(res.status).toBe(200);

    const [entries] = await pool.query(
      "SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ? AND TYPE = 'Invite'",
      [targetId, guildId]
    );
    expect(entries).toHaveLength(1);
  });

  test('200 - owner can invite a user', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Owner Invite Guild' });
    const targetId = await insertUser({ username: 'owninvtgt', email: 'owninvtgt@test.com' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetId });

    expect(res.status).toBe(200);
  });

  test('200 - inviting already-invited user is idempotent', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Idempotent Invite Guild' });
    const targetId = await insertUser({ username: 'idemtgt', email: 'idemtgt@test.com' });

    await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetId });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetId });

    expect(res.status).toBe(200);

    // Still only one entry row
    const [entries] = await pool.query(
      "SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?",
      [targetId, guildId]
    );
    expect(entries).toHaveLength(1);
  });

  test('400 - cannot invite existing member', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Member Invite Guild' });
    const memberId = await insertUser({ username: 'alreadymember', email: 'alreadymember@test.com' });
    await insertGuildMember(memberId, guildId, 'Member');

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: memberId });

    expect(res.status).toBe(400);
  });

  test('403 - member cannot invite', async () => {
    const ownerId  = await insertUser({ username: 'meminvown', email: 'meminvown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Member Invite Block Guild' });
    await insertGuildMember(userId, guildId, 'Member');
    const targetId = await insertUser({ username: 'meminvtgt', email: 'meminvtgt@test.com' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetId });

    expect(res.status).toBe(403);
  });

  test('404 - target user not found', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'No Target Guild' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: 999999 });

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const guildId  = await insertGuildWithOwner(userId, { name: 'Auth Invite Guild' });
    const targetId = await insertUser({ username: 'authinvtgt', email: 'authinvtgt@test.com' });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/invite`)
      .send({ targetUserId: targetId });

    expect(res.status).toBe(401);
  });
});

// Test requesting to join a guild
describe('POST /api/guilds/:id/request', () => {

  test('200 - user can request to join an open guild', async () => {
    const ownerId = await insertUser({ username: 'reqown', email: 'reqown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Open Guild', isOpen: true });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/request`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const [entries] = await pool.query(
      "SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ? AND TYPE = 'Request'",
      [userId, guildId]
    );
    expect(entries).toHaveLength(1);
  });

  test('403 - cannot request to join a closed guild', async () => {
    const ownerId = await insertUser({ username: 'closeown', email: 'closeown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Closed Guild', isOpen: false });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/request`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('400 - cannot request if already a member', async () => {
    const ownerId = await insertUser({ username: 'reqmemown', email: 'reqmemown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Already Member Guild', isOpen: true });
    await insertGuildMember(userId, guildId, 'Member');

    const res = await request(app)
      .post(`/api/guilds/${guildId}/request`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('409 - guild owner cannot request to join another guild', async () => {
    // Make test user an owner of their own guild
    await insertGuildWithOwner(userId, { name: 'My Guild', isOpen: true });

    const ownerId  = await insertUser({ username: 'reqown2', email: 'reqown2@test.com' });
    const guildId2 = await insertGuildWithOwner(ownerId, { name: 'Other Open Guild', isOpen: true });

    const res = await request(app)
      .post(`/api/guilds/${guildId2}/request`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  test('404 - guild not found', async () => {
    const res = await request(app)
      .post('/api/guilds/999999/request')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const ownerId = await insertUser({ username: 'reqauthown', email: 'reqauthown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Auth Request Guild', isOpen: true });

    const res = await request(app)
      .post(`/api/guilds/${guildId}/request`);

    expect(res.status).toBe(401);
  });
});

// Test accepting/rejecting entry
describe('PATCH /api/guilds/:id/entry/:userId', () => {

  test('200 - invitee can accept invite and becomes member', async () => {
    const ownerId = await insertUser({ username: 'acceptown', email: 'acceptown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Accept Invite Guild' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);

    const [members] = await pool.query(
      'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, guildId]
    );
    expect(members).toHaveLength(1);
    expect(members[0].ROLE).toBe('Member');

    // Entry row should be gone now
    const [entries] = await pool.query(
      'SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, guildId]
    );
    expect(entries).toHaveLength(0);
  });

  test('200 - invitee can reject invite', async () => {
    const ownerId = await insertUser({ username: 'rejectown', email: 'rejectown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Reject Invite Guild' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'reject' });

    expect(res.status).toBe(200);

    // Entry row should be gone now
    const [entries] = await pool.query(
      'SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
      [userId, guildId]
    );
    expect(entries).toHaveLength(0);
  });

  test('200 - officer can accept a join request', async () => {
    const ownerId    = await insertUser({ username: 'reqaccown', email: 'reqaccown@test.com' });
    const guildId    = await insertGuildWithOwner(ownerId, { name: 'Accept Request Guild', isOpen: true });
    await insertGuildMember(userId, guildId, 'Officer');
    const requesterId = await insertUser({ username: 'requester', email: 'requester@test.com' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Request')",
      [requesterId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${requesterId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);

    const [members] = await pool.query(
      'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
      [requesterId, guildId]
    );
    expect(members).toHaveLength(1);
    expect(members[0].ROLE).toBe('Member');
  });

  test('200 - officer can reject a join request', async () => {
    const ownerId     = await insertUser({ username: 'reqrejown', email: 'reqrejown@test.com' });
    const guildId     = await insertGuildWithOwner(ownerId, { name: 'Reject Request Guild', isOpen: true });
    await insertGuildMember(userId, guildId, 'Officer');
    const requesterId = await insertUser({ username: 'requester2', email: 'requester2@test.com' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Request')",
      [requesterId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${requesterId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'reject' });

    expect(res.status).toBe(200);

    const [entries] = await pool.query(
      'SELECT * FROM GuildEntry WHERE USER_ID = ? AND GUILD_ID = ?',
      [requesterId, guildId]
    );
    expect(entries).toHaveLength(0);
  });

  test('200 - requires confirmation if user is in another guild, no action taken without confirmLeave', async () => {
    const ownerId  = await insertUser({ username: 'confown', email: 'confown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Confirm Guild' });
    const ownerId2 = await insertUser({ username: 'confown2', email: 'confown2@test.com' });
    const guildId2 = await insertGuildWithOwner(ownerId2, { name: 'Confirm Guild 2' });

    // Test user is already in guild2 as member
    await insertGuildMember(userId, guildId2, 'Member');

    // Invite test user to guild1
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' }); // no confirmLeave

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requiresConfirmation', true);

    // User should NOT have been moved yet
    const [members] = await pool.query(
      'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
      [userId]
    );
    expect(members[0].GUILD_ID).toBe(guildId2);
  });

  test('200 - confirmLeave moves user from old guild to new guild atomically', async () => {
    const ownerId  = await insertUser({ username: 'leaveown', email: 'leaveown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Leave Guild' });
    const ownerId2 = await insertUser({ username: 'leaveown2', email: 'leaveown2@test.com' });
    const guildId2 = await insertGuildWithOwner(ownerId2, { name: 'Leave Guild 2' });
    await insertGuildMember(userId, guildId2, 'Member');

    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept', confirmLeave: true });

    expect(res.status).toBe(200);

    const [members] = await pool.query(
      'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
      [userId]
    );
    expect(members).toHaveLength(1);
    expect(members[0].GUILD_ID).toBe(guildId);
  });

  test('200 - requires confirmation if user is an officer of another guild', async () => {
    const ownerId  = await insertUser({ username: 'offconfown', email: 'offconfown@test.com' });
    const guildId  = await insertGuildWithOwner(ownerId, { name: 'Officer Confirm Guild' });
    const ownerId2 = await insertUser({ username: 'offconfown2', email: 'offconfown2@test.com' });
    const guildId2 = await insertGuildWithOwner(ownerId2, { name: 'Officer Confirm Guild 2' });

    // Test user is an officer in guild2
    await insertGuildMember(userId, guildId2, 'Officer');

    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requiresConfirmation', true);

    // User should still be in guild2
    const [[membership]] = await pool.query(
      'SELECT GUILD_ID FROM GuildMember WHERE USER_ID = ?',
      [userId]
    );
    expect(membership.GUILD_ID).toBe(guildId2);
  });

  test('409 - owner of another guild cannot accept invite', async () => {
    // Test user owns a guild
    await insertGuildWithOwner(userId, { name: 'Owned Guild' });

    const ownerId2 = await insertUser({ username: 'ownerblock', email: 'ownerblock@test.com' });
    const guildId2 = await insertGuildWithOwner(ownerId2, { name: 'Inviting Guild' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId2]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId2}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(409);
  });

  test('409 - guild is full', async () => {
    const ownerId = await insertUser({ username: 'fullown', email: 'fullown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Full Guild' });

    // Fill guild to max (owner already counts as 1)
    for (let i = 1; i < MAX_GUILD_SIZE; i++)
    {
      const memberId = await insertUser({
        username: `fullmember${i}`,
        email:    `fullmember${i}@test.com`
      });
      await insertGuildMember(memberId, guildId, 'Member');
    }

    // Invite the test user
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(409);
  });

  test('403 - non-invitee cannot accept an invite', async () => {
    const ownerId    = await insertUser({ username: 'nonacc', email: 'nonacc@test.com' });
    const guildId    = await insertGuildWithOwner(ownerId, { name: 'Non Acceptor Guild' });
    const inviteeId  = await insertUser({ username: 'invitee', email: 'invitee@test.com' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [inviteeId, guildId]
    );

    // Test user (not the invitee) tries to accept
    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${inviteeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(403);
  });

  test('400 - invalid action', async () => {
    const ownerId = await insertUser({ username: 'badactown', email: 'badactown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Bad Action Guild' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'maybe' });

    expect(res.status).toBe(400);
  });

  test('404 - entry not found', async () => {
    const ownerId = await insertUser({ username: 'noentryown', email: 'noentryown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'No Entry Guild' });

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const ownerId = await insertUser({ username: 'authenown', email: 'authenown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Auth Entry Guild' });

    const res = await request(app)
      .patch(`/api/guilds/${guildId}/entry/${userId}`)
      .send({ action: 'accept' });

    expect(res.status).toBe(401);
  });
});

// Test fetching a user's invites
// (Technically this is a user endpoint but it's kinda a hybrid guild-user endpoint)
describe('GET /api/users/me/guild-invites', () => {

  test('200 - returns pending invites for current user', async () => {
    const ownerId = await insertUser({ username: 'myinvown', email: 'myinvown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'My Invite Guild' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Invite')",
      [userId, guildId]
    );

    const res = await request(app)
      .get('/api/users/me/guild-invites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('invites');
    expect(res.body.invites.length).toBeGreaterThanOrEqual(1);
    expect(res.body.invites[0]).toHaveProperty('GUILD_ID', guildId);
    expect(res.body.invites[0]).toHaveProperty('guildName', 'My Invite Guild');
  });

  test('200 - returns empty array when no invites', async () => {
    const res = await request(app)
      .get('/api/users/me/guild-invites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.invites).toHaveLength(0);
  });

  test('200 - does not return REQUEST type entries', async () => {
    const ownerId = await insertUser({ username: 'reqnotinv', email: 'reqnotinv@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Request Not Invite Guild', isOpen: true });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Request')",
      [userId, guildId]
    );

    const res = await request(app)
      .get('/api/users/me/guild-invites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const guildIds = res.body.invites.map(i => i.GUILD_ID);
    expect(guildIds).not.toContain(guildId);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/users/me/guild-invites');

    expect(res.status).toBe(401);
  });
});

// Test fetching a guild's incoming requests to join
describe('GET /api/guilds/:id/requests', () => {

  test('200 - officer can view join requests', async () => {
    const ownerId     = await insertUser({ username: 'viewreqown', email: 'viewreqown@test.com' });
    const guildId     = await insertGuildWithOwner(ownerId, { name: 'View Requests Guild', isOpen: true });
    await insertGuildMember(userId, guildId, 'Officer');
    const requesterId = await insertUser({ username: 'viewreq', email: 'viewreq@test.com' });
    await pool.query(
      "INSERT INTO GuildEntry (USER_ID, GUILD_ID, TYPE) VALUES (?, ?, 'Request')",
      [requesterId, guildId]
    );

    const res = await request(app)
      .get(`/api/guilds/${guildId}/requests`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
    expect(res.body.requests.length).toBeGreaterThanOrEqual(1);
    expect(res.body.requests[0]).toHaveProperty('USER_ID', requesterId);
    expect(res.body.requests[0]).toHaveProperty('USERNAME');
  });

  test('200 - returns empty array when no requests', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Empty Requests Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}/requests`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(0);
  });

  test('403 - member cannot view requests', async () => {
    const ownerId = await insertUser({ username: 'memreqown', email: 'memreqown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Member Request Guild' });
    await insertGuildMember(userId, guildId, 'Member');

    const res = await request(app)
      .get(`/api/guilds/${guildId}/requests`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('403 - non-member cannot view requests', async () => {
    const ownerId = await insertUser({ username: 'nonmemreqown', email: 'nonmemreqown@test.com' });
    const guildId = await insertGuildWithOwner(ownerId, { name: 'Non Member Requests Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}/requests`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('404 - guild not found', async () => {
    const res = await request(app)
      .get('/api/guilds/999999/requests')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const guildId = await insertGuildWithOwner(userId, { name: 'Auth Requests Guild' });

    const res = await request(app)
      .get(`/api/guilds/${guildId}/requests`);

    expect(res.status).toBe(401);
  });
});
