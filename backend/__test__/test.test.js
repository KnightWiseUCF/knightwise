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
const { TEST_USER,
        getAuthToken,
        verifyTestDatabase,
        insertQuestion,
        submitAndFetch,
      } = require("./testHelpers");

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

// Test submit route
describe("POST /api/test/submit", () => {

  describe("Authorization Tests", () => { 
    
    test("POST /api/test/submit requires auth", async () => {
      const res = await request(app)
        .post('/api/test/submit')
        .send({ problem_id: 1, userAnswer: 'test', category: 'c', topic: 't' });
      expect(res.statusCode).toBe(401);
    });

    test("POST /api/test/submit returns 404 for unknown question", async () => {
      const res = await request(app)
        .post('/api/test/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({ problem_id: 999999, userAnswer: 'test', category: 'c', topic: 't' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("Multiple Choice Serialization Tests", () => { 

    test("POST /api/test/submit serializes Multiple Choice answer correctly", async () => {

      const questionId = await insertQuestion('Multiple Choice', 
      [
        { text: 'Correct option', isCorrect: true  },
        { text: 'Wrong option',   isCorrect: false },
      ]);

      // Submit and get response
      const { res, stored } = await submitAndFetch(questionId, 'Correct option', token);

      expect(res.statusCode).toBe(201);
      expect(stored).not.toBeNull();
      expect(stored.type).toBe('MultipleChoice');
      expect(stored.selected).toBe('Correct option');
    });

    test("POST /api/test/submit grades Multiple Choice correctly", async () => {

      const questionId = await insertQuestion('Multiple Choice',
      [
        { text: 'Right', isCorrect: true  },
        { text: 'Wrong', isCorrect: false },
      ]);

      const { res } = await submitAndFetch(questionId, 'Right', token);

      expect(res.body.isCorrect).toBe(true);
      expect(parseFloat(res.body.pointsEarned)).toBeGreaterThan(0);
    });
  });

  describe("Fill in the Blanks Serialization Tests", () => { 

    test("POST /api/test/submit serializes Fill in the Blanks answer correctly", async () => {

      const questionId = await insertQuestion('Fill in the Blanks',
      [
        { text: 'false', isCorrect: true },
      ]);

      const { res, stored } = await submitAndFetch(questionId, 'false', token);

      expect(res.statusCode).toBe(201);
      expect(stored).not.toBeNull();
      expect(stored.type).toBe('FillInTheBlanks');
      expect(stored.entered).toBe('false');
    });
  });

  describe("Select All That Apply Serialization Tests", () => { 

    test("POST /api/test/submit serializes Select All That Apply answer correctly", async () => {

      const questionId = await insertQuestion('Select All That Apply',
      [
        { text: 'Option A', isCorrect: true  },
        { text: 'Option B', isCorrect: true  },
        { text: 'Option C', isCorrect: false },
      ]);

      const userAnswer = ['Option A', 'Option B'];
      const { res, stored } = await submitAndFetch(questionId, userAnswer, token);

      expect(res.statusCode).toBe(201);
      expect(stored).not.toBeNull();
      expect(stored.type).toBe('SelectAllThatApply');
      expect(stored.selected).toEqual(userAnswer);
    });
  });

  describe("Ranked Choice Serialization Tests", () => { 

    test("POST /api/test/submit serializes Ranked Choice answer correctly", async () => {

      const questionId = await insertQuestion('Ranked Choice',
      [
        { text: 'First',  isCorrect: true, rank: 1 },
        { text: 'Second', isCorrect: true, rank: 2 },
        { text: 'Third',  isCorrect: true, rank: 3 },
      ]);

      const userAnswer = ['First', 'Second', 'Third'];
      const { res, stored } = await submitAndFetch(questionId, userAnswer, token);

      expect(res.statusCode).toBe(201);
      expect(stored).not.toBeNull();
      expect(stored.type).toBe('RankedChoice');
      expect(stored.order).toEqual(userAnswer);
    });
  });

  describe("Drag and Drop Serialization Tests", () => {

    test("POST /api/test/submit serializes Drag and Drop answer correctly", async () => {

      const questionId = await insertQuestion('Drag and Drop',
      [
        { text: 'Answer A', isCorrect: true, placement: 'Zone 1' },
        { text: 'Answer B', isCorrect: true, placement: 'Zone 2' },
      ]);

      const userAnswer = { 'Answer A': 'Zone 1', 'Answer B': 'Zone 2' };
      const { res, stored } = await submitAndFetch(questionId, userAnswer, token);

      expect(res.statusCode).toBe(201);
      expect(stored).not.toBeNull();
      expect(stored.type).toBe('DragAndDrop');
      expect(stored.placements).toEqual(userAnswer);
    });
  });

  describe("JSON Validation Tests", () => {

    test("POST /api/test/submit always stores valid JSON in USER_ANSWER column", async () => {
      const cases = [
        {
          type:     'Multiple Choice',
          answer:   'Option A',
          answers:  [
            { text: 'Option A', isCorrect: true }, 
            { text: 'Option B', isCorrect: false },
          ]
        },
        {
          type:     'Fill in the Blanks',
          answer:   'some text',
          answers:  [
            { text: 'some text', isCorrect: true },
          ]
        },
        {
          type:     'Select All That Apply',
          answer:   ['Option A'],
          answers:  [
            { text: 'Option A', isCorrect: true  },
            { text: 'Option B', isCorrect: false },
          ]
        },
        {
          type:     'Ranked Choice',
          answer:   ['First', 'Second'],
          answers:  [
            { text: 'First',  isCorrect: true, rank: 1 },
            { text: 'Second', isCorrect: true, rank: 2 },
          ]
        },
        {
          type:     'Drag and Drop',
          answer:   { 'Answer A': 'Zone 1' },
          answers:  [
            { text: 'Answer A', isCorrect: true, placement: 'Zone 1' },
          ]
        },
      ];

      for (const { type, answer, answers } of cases)
      {
        const questionId = await insertQuestion(type, answers);

        await request(app)
          .post('/api/test/submit')
          .set('Authorization', `Bearer ${token}`)
          .send({ problem_id: questionId, userAnswer: answer, category: 'c', topic: 't' });

        const [rows] = await pool.query(
          'SELECT USER_ANSWER FROM Response ORDER BY ID DESC LIMIT 1'
        );

        // Should always be parseable JSON with type field
        expect(() => JSON.parse(rows[0].USER_ANSWER)).not.toThrow();
        const parsed = JSON.parse(rows[0].USER_ANSWER);
        expect(parsed.type).toBeDefined();

        await pool.query('DELETE FROM Response');
        await pool.query('DELETE FROM Question');
      }
    });
  });
});