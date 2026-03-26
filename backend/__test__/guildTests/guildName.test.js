////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildName.test.js
//  Description:   Integration tests for guild name generation:
//                 GET /api/guilds/name/generate
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 guildNames
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../../server');
const { getAuthToken, verifyTestDatabase, insertGuild } = require('../testHelpers');
const guildNames = require('../../config/guildNames');

// Mock tiny word bank so we don't have to insert
// hundreds of test guilds to exhaust all available names
jest.mock('../../config/guildNames', () => ({
  adjectives: ['Ancient', 'Blazing'],
  pluralNouns: ['Wolves', 'Dragons'],
}));

let token;
let guildOwnerIds = [];

// Guild owners are unique so we'll need 4 users
// for the 4 guilds we use in this test
const GUILD_OWNERS = [
  { username: 'guild_owner1' },
  { username: 'guild_owner2' },
  { username: 'guild_owner3' },
  { username: 'guild_owner4' },
];

beforeAll(async () => {
  await verifyTestDatabase(pool);
  token = await getAuthToken();

  // Insert guild owners for test
  for (const u of GUILD_OWNERS)
  {
    const [result] = await pool.query(
      `INSERT INTO User (USERNAME, EMAIL, PASSWORD) VALUES (?, ?, 'placeholder')`,
      [u.username, `${u.username}@test.com`]
    );
    guildOwnerIds.push(result.insertId);
  }
});

afterEach(async () => {
  await pool.query('DELETE FROM Guild');
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error('Error closing pool in guildName.test.js:', err);
  }
});

// Test generating guild names
describe('GET /api/guilds/name/generate', () => {

  test('200 - returns a valid guild name', async () => {
    const res = await request(app)
      .get('/api/guilds/name/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(typeof res.body.name).toBe('string');
  });

  test('200 - returned name is a valid adjective and plural noun from word bank', async () => {
    const res = await request(app)
      .get('/api/guilds/name/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // In case we ever make nouns multiple words
    const [adjective, ...nounParts] = res.body.name.split(' ');
    const noun = nounParts.join(' ');

    expect(guildNames.adjectives).toContain(adjective);
    expect(guildNames.pluralNouns).toContain(noun);
  });

  test('200 - does not return a name already taken by an existing guild', async () => {
    // Mock bank is 2x2, leave only one combination available
    const namesToInsert = ['Ancient Wolves', 'Ancient Dragons', 'Blazing Wolves'];
    for (let i = 0; i < namesToInsert.length; i++)
    {
      await insertGuild({ name: namesToInsert[i], ownerId: guildOwnerIds[i] });
    }
    // 'Blazing Dragons' is the only one left

    const res = await request(app)
      .get('/api/guilds/name/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Blazing Dragons');
  });

  test('503 - all guild name combinations are taken', async () => {
    // Insert a guild for all 4 combinations
    const namesToInsert = ['Ancient Wolves', 'Ancient Dragons', 'Blazing Wolves', 'Blazing Dragons'];
    for (let i = 0; i < namesToInsert.length; i++)
    {
      await insertGuild({ name: namesToInsert[i], ownerId: guildOwnerIds[i] });
    }

    const res = await request(app)
      .get('/api/guilds/name/generate')
      .set('Authorization', `Bearer ${token}`);

    // Looks like we gotta add more names!
    expect(res.status).toBe(503);
  });

  test('401 - no auth token', async () => {
    const res = await request(app).get('/api/guilds/name/generate');
    expect(res.status).toBe(401);
  });
});
