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
//
////////////////////////////////////////////////////////////////

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, pool } = require("../server");
const { TEST_USER, verifyTestDatabase } = require("./testHelpers");

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
  await pool.query("DELETE FROM Professor");
  await pool.query("DELETE FROM EmailCode");
  await pool.query('DELETE FROM AnswerText');
  await pool.query('DELETE FROM Question');
});

afterEach(async () => {
  await pool.query('DELETE FROM Response');
  await pool.query("DELETE FROM Professor");
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
        'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 0]
      );

      const res = await request(app)
        .get("/api/admin/unverifiedprofs")
        .set(headers);
      expect(res.statusCode).toBe(200);
    });

    test("POST /api/admin/verifyprof/:id verifies a prof", async () => {
      const [result] = await pool.query(
        'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 0]
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
        'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, ?)',
        [TEST_USER.username, "test@email.com", TEST_USER.password, TEST_USER.firstName, TEST_USER.lastName, 0]
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

})