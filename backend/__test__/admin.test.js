////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     KnightWise Team
//  File:          admin.test.js
//  Description:   Unit tests for admin routes.
//
//  Dependencies:  supertest
//                 jsonwebtoken
//                 node-mailjet (mocked)
//                 discordWebhook (mocked)
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 itemConfig
//
////////////////////////////////////////////////////////////////

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, pool } = require("../server");
const { TEST_USER,
        verifyTestDatabase,
        insertQuestion,
        getAuthToken,
        insertUser,
        insertGuildWithOwner,
      } = require("./testHelpers");
const { ITEM_TYPES } = require('../../shared/itemConfig');

// Mock Mailjet
const Mailjet = require('node-mailjet');
jest.mock("node-mailjet", () => {
  const sendMock = jest.fn().mockResolvedValue({
    body: { Messages: [{ Status: "success" }] },
  });
  const postMock = jest.fn(() => ({ request: sendMock }));
  return {
    apiConnect: jest.fn(() => ({ post: postMock })),
  };
});

// Mock Discord webhook
const { notifyUserEvent } = require('../services/discordWebhook');
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

const headers = {
  'Authorization': `Bearer ${process.env.ADMIN_KEY}`,
  'Content-Type': "application/json",
}

let token = process.env.ADMIN_KEY;

// Test setup/teardown
// Clear test tables before/after each test
beforeAll(async () => {
  // Extra database safety check
  await verifyTestDatabase(pool);

  await pool.query("DELETE FROM User");
  await pool.query("DELETE FROM EmailCode");
  await pool.query('DELETE FROM AnswerText');
  await pool.query('DELETE FROM Question');
});

afterEach(async () => {
  await pool.query('DELETE FROM Response');
  await pool.query('DELETE FROM AnswerText');
  await pool.query('DELETE FROM Question');
  await pool.query("DELETE FROM User");
});

afterAll(async () => {
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error("Error closing pool in /admin unit test:", err);
  }
});

describe("Admin Routes", () => {

    // user endpoints
    test("GET /api/admin/getuser gets a user with an id", async () => {
      const [result] = await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
        ["testingforever", "testtest@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName]
      );

      const userId = result.insertId;

      const res = await request(app)
        .get("/api/admin/getuser")
        .set("Authorization", `Bearer ${token}`)
        .query({id: userId});
      
      expect(res.statusCode).toBe(200);
    });

    test("GET /api/admin/getuser gets a user with a username", async () => {
      await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
        ["anothertest", "testttest@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName]
      );

      const res = await request(app)
        .get("/api/admin/getuser")
        .set("Authorization", `Bearer ${token}`)
        .query({username: "anothertest"});

      expect(res.statusCode).toBe(200);
    });

    test("POST /api/admin/createuser creates a new user", async () => {

      const res = await request(app)
        .post("/api/admin/createuser")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "testerstesttest",
          email: "supertest@test.com",
          password: TEST_USER.password,
          firstName: TEST_USER.firstName,
          lastName: TEST_USER.lastName
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe("User Registered");
    });

    test("DELETE /api/admin/users/:id deletes a user", async () => {
      const [result] = await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
        ["testingtestguytest", "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName]
      );

      const userId = result.insertId;

      const res = await request(app)
        .del(`/api/admin/users/${userId}`)
        .set(headers);
      
      expect(res.body.message).toBe("Account deleted successfully");
      expect(res.statusCode).toBe(200);
    });

    // question tests
    test("GET /api/admin/problems/:id retieves a question", async () => {
      const [result] = await pool.query(
        'INSERT INTO Question (QUESTION_TEXT, SUBCATEGORY, SECTION) VALUES (?, ?, ?)',
        ["Q1", "test", "A"]
      );

      const questionId = result.insertId
      
      const res = await request(app)
        .get(`/api/admin/problems/${questionId}`)
        .set(headers);
      
      expect(res.statusCode).toBe(200);
    });

    test("POST /api/admin/createquestion creates a question", async () => {
      const question = {
        type: 'type',
        author_exam_id: 'author',
        section: 'sec',
        category: 'cat',
        subcategory: 'sub',
        points_possible: 1.0,
        question_text: 'alias',
        owner_id: null,
        is_published: true,
        answer_text: ['a'],
        answer_correctness: [1],
        answer_rank: [1],
        answer_placement: ['a'],
      }

      const res = await request(app)
        .post('/api/admin/createquestion')
        .set('Authorization', `Bearer ${process.env.ADMIN_KEY}`)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(question);
      
      expect(res.body.message).toBe("Question added");
      expect(res.statusCode).toBe(201);

      // Expect Discord notification
      expect(notifyUserEvent).toHaveBeenCalledWith(
        expect.stringContaining("New question published")
      );
    });

    test("DELETE /api/admin/problems/:id deletes a question", async () => {
      const [result] = await pool.query(
        'INSERT INTO Question (QUESTION_TEXT, SUBCATEGORY, SECTION) VALUES (?, ?, ?)',
        ["Q1", "test", "A"]
      );

      const questionId = result.insertId

      const res = await request(app)
        .del(`/api/admin/problems/${questionId}`)
        .set(headers);
      
      expect(res.body.message).toBe("Question deleted successfully");
      expect(res.statusCode).toBe(200);
    });

    // verification tests
    test("GET /api/admin/unverifiedprofs returns unverified profs", async () => {
      const [result] = await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, IS_PROF, VERIFIED) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 1, 0]
      );

      const res = await request(app)
        .get("/api/admin/unverifiedprofs")
        .set(headers);
      expect(res.statusCode).toBe(200);
    });

    test("POST /api/admin/verifyprof/:id verifies a prof", async () => {
      const [result] = await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, IS_PROF, VERIFIED) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 1, 0]
      );

      const profId = result.insertId
      const res = await request(app)
        .post(`/api/admin/verifyprof/${profId}`)
        .set(headers);

      expect(res.statusCode).toBe(200);
    });

    test("POST /api/admin/verifyprof/:id sends verification email on success", async () => {

      // Insert professor
      const [result] = await pool.query(
        'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, IS_PROF, VERIFIED) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 1, 0]
      );

      // Verify professor
      await request(app)
        .post(`/api/admin/verifyprof/${result.insertId}`)
        .set(headers);

      // Expect an email to be sent
      const mjInstance = Mailjet.apiConnect.mock.results[0].value;
      expect(mjInstance.post).toHaveBeenCalledWith('send', { version: 'v3.1' });
    });

    test("POST /api/admin/verifyprof/:id rejects professor JWT", async () => {
      const profToken = jwt.sign(
        { userId: 999, role: 'professor', verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Professors can't verify professors, only admins can!
      const res = await request(app)
        .post("/api/admin/verifyprof/1")
        .set("Authorization", `Bearer ${profToken}`);

      expect(res.statusCode).toBe(401);
    });

    // admin tokens tests
    test("DELETE /api/admin/users/:id requires admin token", async () => {
      const res = await request(app).delete("/api/admin/users/noauth");
      expect(res.statusCode).toBe(401);
    });

    test("POST /api/admin/createuser requires admin token", async () => {
      const res = await request(app).post("/api/admin/createuser");
      expect(res.statusCode).toBe(401);
    });

    test("GET /api/admin/getuser requires admin token", async () => {
      const res = await request(app).get("/api/admin/getuser");
      expect(res.statusCode).toBe(401);
    });

    test("DELETE /api/admin/problems/:id requires auth token", async () => {
      const res = await request(app).delete("/api/admin/problems/noauth");
      expect(res.statusCode).toBe(401);
    });

    test("POST /api/admin/createquestion requires auth token", async () => {
      const res = await request(app).post("/api/admin/createquestion");
      expect(res.statusCode).toBe(401);
    });

    test("GET /api/admin/problems/:id requires auth token", async () => {
      const res = await request(app).get("/api/admin/problems/noauth");
      expect(res.statusCode).toBe(401);
    });

    test("GET /api/admin/unverifiedprofs requires admin token", async () => {
      const res = await request(app).get("/api/admin/unverifiedprofs");
      expect(res.statusCode).toBe(401);
    });

    test("POST /api/admin/verifyprof/:id requires admin token", async () => {
      const res = await request(app).post("/api/admin/verifyprof/noauth");
      expect(res.statusCode).toBe(401);
    });

    test("GET /api/admin/published returns all published questions for admin", async () => { 
      // Insert 3 questions, two published and one draft
      await insertQuestion("MCQ", [], { isPublished: true });
      await insertQuestion("MCQ", [], { isPublished: false });
      await insertQuestion("MCQ", [], { isPublished: true });

      // Call endpoint as admin
      const res = await request(app)
        .get("/api/admin/published")
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);

      // Admin should be able to see both published questions
      expect(res.statusCode).toBe(200);
      expect(res.body.published.length).toBeGreaterThanOrEqual(2);
    });
    
    // store item tests
    test('POST /api/admin/store/createitem creates a store item', async () => {
      const res = await request(app)
        .post('/api/admin/store/createitem')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemType: ITEM_TYPES.FLAIR, itemCost: 5.00, itemName: 'Test Flair' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('itemId');
      expect(res.body.message).toBe('Store item successfully created');

      // Expect Discord notification
      expect(notifyUserEvent).toHaveBeenCalledWith(
        expect.stringContaining('Test Flair')
      );

      await pool.query('DELETE FROM StoreItem WHERE ID = ?', [res.body.itemId]);
    });

    test('POST /api/admin/store/createitem rejects invalid item type', async () => {
      const res = await request(app)
        .post('/api/admin/store/createitem')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemType: 'invalid_type', itemCost: 5.00, itemName: 'Test Flair' });

      expect(res.status).toBe(400);
    });

    test('POST /api/admin/store/createitem rejects negative cost', async () => {
      const res = await request(app)
        .post('/api/admin/store/createitem')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemType: ITEM_TYPES.FLAIR, itemCost: -5.00, itemName: 'Test Flair' });

      expect(res.status).toBe(400);
    });

    test('POST /api/admin/store/createitem rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/admin/store/createitem')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemType: ITEM_TYPES.FLAIR });

      expect(res.status).toBe(400);
    });

    test('POST /api/admin/store/createitem requires admin token', async () => {
      const res = await request(app)
        .post('/api/admin/store/createitem')
        .send({ itemType: ITEM_TYPES.FLAIR, itemCost: 5.00, itemName: 'Test Flair' });

      expect(res.status).toBe(401);
    });

    // Test admin Guild creation (allows arbitrary Guild names and specified Owner ID)
    describe('POST /api/admin/guilds', () => {

      let userId;

      beforeAll(async () => {
        // create test user to own Guilds
        userId = await insertUser({ username: 'guild_owner', email: 'guild_owner@test.com' });
      });

      afterEach(async () => {
        await pool.query('DELETE FROM GuildMember');
        await pool.query('DELETE FROM Guild');
      });

      afterAll(async () => {
        await pool.query('DELETE FROM User WHERE ID = ?', [userId]);
      });

      test('201 - successfully creates guild and inserts owner as member', async () => {
        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Admin Guild', ownerId: userId });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('guildId');

        // verify guild exists
        const [guilds] = await pool.query('SELECT * FROM Guild WHERE ID = ?', [res.body.guildId]);
        expect(guilds).toHaveLength(1);
        expect(guilds[0].NAME).toBe('Admin Guild');

        // verify owner membership
        const [members] = await pool.query(
          'SELECT ROLE FROM GuildMember WHERE USER_ID = ? AND GUILD_ID = ?',
          [userId, res.body.guildId]
        );
        expect(members).toHaveLength(1);
        expect(members[0].ROLE).toBe('Owner');
      });

      test('400 - missing guild name', async () => {
        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ ownerId: userId });

        expect(res.status).toBe(400);
      });

      test('400 - invalid owner ID', async () => {
        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Guild Invalid', ownerId: 'not-a-number' });

        expect(res.status).toBe(400);
      });

      test('404 - owner does not exist', async () => {
        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Guild Unknown', ownerId: 999999 });

        expect(res.status).toBe(404);
      });

      test('409 - owner already in a guild', async () => {
        // create guild for other user
        const otherId = await insertUser({ username: 'otheruser', email: 'otheruser@test.com' });
        await insertGuildWithOwner(otherId, { name: 'Existing Guild' });

        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'New Guild', ownerId: otherId });

        expect(res.status).toBe(409);

        // Cleanup
        await pool.query(`DELETE FROM User WHERE ID = ${otherId}`);
      });

      test('409 - guild name already taken', async () => {
        // create guild for other user
        const user1 = await insertUser({ username: 'user1', email: 'user1@test.com' });
        await insertGuildWithOwner(user1, { name: 'Duplicate Guild' });

        const user2 = await insertUser({ username: 'user2', email: 'user2@test.com' });

        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Duplicate Guild', ownerId: user2 });

        expect(res.status).toBe(409);

        // Cleanup
        await pool.query('DELETE FROM User WHERE ID IN (?, ?)', [user1, user2]);
      });

      test('401 - non-admin cannot create guild', async () => {
        const nonAdminToken = await getAuthToken();

        const res = await request(app)
          .post('/api/admin/guilds')
          .set('Authorization', `Bearer ${nonAdminToken}`)
          .send({ name: 'Admin Only', ownerId: userId });

        expect(res.status).toBe(401);
      });
    });
})