////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          test.test.js
//  Description:   Unit tests for test routes.
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 discordWebhook (mocked)
//
////////////////////////////////////////////////////////////////

const request = require("supertest");
const { app, pool } = require("../server");
const { TEST_USER, getAuthToken, verifyTestDatabase } = require("./testHelpers");

// Mock Discord webhook
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

let token;

// Test setup/teardown
beforeAll(async () => {
  // Extra database safety check
  await verifyTestDatabase(pool);

  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  token = await getAuthToken();
});

afterEach(async () => {
  await pool.query('DELETE FROM Response');
  await pool.query('DELETE FROM AnswerText');
  await pool.query('DELETE FROM Question');
});

afterAll(async () => {
  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error("Error closing pool in /test unit test:", err);
  }
});

// GET topicName test cases
test("GET /api/test/topic/:topicName", async () => {
  // give
  await pool.query(
    'INSERT INTO Question (QUESTION_TEXT, SUBCATEGORY, SECTION) VALUES (?, ?, ?)',
    ["Q1", "test", "A"]
  );
  await pool.query(
    'INSERT INTO Question (QUESTION_TEXT, SUBCATEGORY, SECTION) VALUES (?, ?, ?)',
    ["Q2", "test", "A"]
  );

  // when
  const res = await request(app)
    .get("/api/test/topic/test")
    .set("Authorization", `Bearer ${token}`);

  // then
  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBe(2);
  expect(res.body[0].SUBCATEGORY).toBe("test");
});

test("GET /api/test/topic/:topicName requires auth", async () => {
  const res = await request(app).get("/api/test/topic/noauth");
  expect(res.statusCode).toBe(401);
});

// mocktest test cases
test("GET /api/test/mocktest", async () => {
  // give (Create 20 problems, 5 per section)
  const sections = ["A", "B", "C", "D"];
  const problems = sections.flatMap((sec) =>
    Array.from({ length: 5 }, (_, i) => ({
      question: `Q${sec}${i + 1}`,
      subcategory: "Test",
      section: sec,
    }))
  );

  // Insert all problems
  for (const problem of problems)
  {
    await pool.query(
      'INSERT INTO Question (QUESTION_TEXT, SUBCATEGORY, SECTION) VALUES (?, ?, ?)',
      [problem.question, problem.subcategory, problem.section]
    );
  }

  // when
  const res = await request(app)
    .get("/api/test/mocktest")
    .set("Authorization", `Bearer ${token}`);

  // then
  // Expect 12 since /mocktest gets 3 questions from each of 4 sections
  expect(res.statusCode).toBe(200);
  expect(res.body.total).toBe(12);
  expect(res.body.questions.length).toBe(12);
});

test("GET /api/test/mocktest requires auth", async () => {
  const res = await request(app).get("/api/test/mocktest");
  expect(res.statusCode).toBe(401);
});