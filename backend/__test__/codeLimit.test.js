////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          codeLimit.test.js
//  Description:   Integration tests for programming question
//                 daily submission limit enforcement in topic
//                 practice and mock test question fetching.
//
//  Dependencies:  supertest
//                 testHelpers
//                 mysql2 connection pool (server.js)
//                 codeLimits
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const { verifyTestDatabase, getAuthToken, insertQuestion } = require('./testHelpers');
const { MAX_SUBMISSIONS_PER_DAY } = require('../config/codeLimits');

let token;
let userId;
let programmingQuestionId;
let nonProgrammingIds = []; // To pad the test db so we don't 404

/**
 * Helper function, inserts a test case for a programming question.
 * If we end up needing this in another file, extract to testHelper.js
 * @param {number} questionId - The programming question to attach the test case to
 * @returns {Promise<number>} Inserted test case ID
 */
const insertTestCase = async (questionId) => {
  const [result] = await pool.query(
    `INSERT INTO TestCase (QUESTION_ID, INPUT, EXPECTED_OUTPUT) VALUES (?, ?, ?)`,
    [questionId, '1', '1']
  );
  return result.insertId;
};

/**
 * Helper function, inserts a programming Response row directly into db,
 * bypasses Judge0.
 * @param {number} userId     - User who submitted
 * @param {number} questionId - Programming question to submit for
 */
const insertProgrammingResponse = async (userId, questionId) => {
  await pool.query(
    `INSERT INTO Response 
     (USERID, PROBLEM_ID, USER_ANSWER, ISCORRECT, POINTS_EARNED, POINTS_POSSIBLE, CATEGORY, TOPIC)
     VALUES (?, ?, ?, FALSE, 0, 2, 'Test Category', 'Test Topic')`,
    [userId, questionId, JSON.stringify({ type: 'Programming', language: 'Python', code: 'pass' })]
  );
};

beforeAll(async () => {
  await verifyTestDatabase(pool);
  token = await getAuthToken();

  // Get userId from token
  const [rows] = await pool.query(
    `SELECT ID FROM User WHERE USERNAME = 'testuser' LIMIT 1`
  );
  userId = rows[0].ID;

  // Insert a published prog question in section A with one test case
  programmingQuestionId = await insertQuestion('Programming', [], { points: 2.00 });
  await pool.query(
    `UPDATE Question SET IS_PUBLISHED = 1, SUBCATEGORY = 'Test Topic', SECTION = 'A' WHERE ID = ?`,
    [programmingQuestionId]
  );
  await insertTestCase(programmingQuestionId);

  // Pad db with non-programming questions so tests don't 404
  // if the topic practice/mock test endpoints skip programming questions
  const sectionsAndTopics = [
    { section: 'A', topic: 'Test Topic' },
    { section: 'A', topic: 'Test Topic' },
    { section: 'A', topic: 'Test Topic' },
    { section: 'B', topic: 'Test Topic B' },
    { section: 'B', topic: 'Test Topic B' },
    { section: 'B', topic: 'Test Topic B' },
    { section: 'C', topic: 'Test Topic C' },
    { section: 'C', topic: 'Test Topic C' },
    { section: 'C', topic: 'Test Topic C' },
    { section: 'D', topic: 'Test Topic D' },
    { section: 'D', topic: 'Test Topic D' },
    { section: 'D', topic: 'Test Topic D' },
  ];

  // Insert questions
  for (const { section, topic } of sectionsAndTopics) 
  {
    const id = await insertQuestion('Multiple Choice', 
    [
      { text: 'Answer', isCorrect: true }
    ], { points: 2.00 });
    await pool.query(
      `UPDATE Question SET IS_PUBLISHED = 1, SUBCATEGORY = ?, SECTION = ? WHERE ID = ?`,
      [topic, section, id]
    );
    nonProgrammingIds.push(id);
  }
});

afterEach(async () => {
  // Clear programming responses between tests so limit resets
  await pool.query(
    `DELETE FROM Response WHERE USERID = ? AND PROBLEM_ID = ?`,
    [userId, programmingQuestionId]
  );
});

afterAll(async () => {
  // Clean up
  await pool.query(`DELETE FROM TestCase WHERE QUESTION_ID = ?`, [programmingQuestionId]);
  await pool.query(`DELETE FROM Question WHERE ID = ?`, [programmingQuestionId]);

  if (nonProgrammingIds.length > 0) 
  {
    await pool.query(
      `DELETE FROM Question WHERE ID IN (${nonProgrammingIds.map(() => '?').join(',')})`,
      nonProgrammingIds
    );
  }

  try 
  {
    await pool.end();
  } 
  catch (err) 
  {
    console.error("Error closing pool in codeLimit.test.js:", err);
  }
});

// Test code/canSubmit endpoint
describe('GET /api/code/canSubmit', () => {
  test('returns canSubmit: true and full remaining count when user has no submissions today', async () => {
    const res = await request(app)
      .get('/api/code/canSubmit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canSubmit).toBe(true);
    expect(res.body.remaining).toBe(MAX_SUBMISSIONS_PER_DAY);
  });

  test('returns decremented remaining count after submissions', async () => {
    // Two responses
    await insertProgrammingResponse(userId, programmingQuestionId);
    await insertProgrammingResponse(userId, programmingQuestionId);

    const res = await request(app)
      .get('/api/code/canSubmit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canSubmit).toBe(true); // Can still submit
    // Should have decremented by 2
    expect(res.body.remaining).toBe(MAX_SUBMISSIONS_PER_DAY - 2);
  });

  test('returns canSubmit: false and remaining: 0 when limit is reached', async () => {
    // Reach submit limit
    for (let i = 0; i < MAX_SUBMISSIONS_PER_DAY; i++) 
    {
      await insertProgrammingResponse(userId, programmingQuestionId);
    }

    const res = await request(app)
      .get('/api/code/canSubmit')
      .set('Authorization', `Bearer ${token}`);

    // No more submits!
    expect(res.status).toBe(200);
    expect(res.body.canSubmit).toBe(false);
    expect(res.body.remaining).toBe(0);
  });

  test('returns 401 when no token provided', async () => {
    const res = await request(app)
      .get('/api/code/canSubmit');

    expect(res.status).toBe(401);
  });

  test('does not count test runs against remaining submissions', async () => {
    // Insert a test run
    await pool.query(
      'INSERT INTO TestRun (USERID, QUESTION_ID) VALUES (?, ?)',
      [userId, programmingQuestionId]
    );

    const res = await request(app)
      .get('/api/code/canSubmit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.canSubmit).toBe(true);
    // Should still have full daily submissions
    expect(res.body.remaining).toBe(MAX_SUBMISSIONS_PER_DAY);

    // Cleanup
    await pool.query(
      'DELETE FROM TestRun WHERE USERID = ? AND QUESTION_ID = ?',
      [userId, programmingQuestionId]
    );
  });
});

// Test topic practice fetching
// If a user has no more daily submissions,
// topic practice should not give them a programming question.
// Otherwise, topic practice should give the user a maximum
// of one programming question per topic practice generation.
describe('GET /api/test/topic/:topicName - programming limit', () => {
  test('includes programming question when user is under the limit', async () => {
    const res = await request(app)
      .get('/api/test/topic/Test Topic')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const types = res.body.map(q => q.TYPE);
    expect(types).toContain('Programming');
  });

  test('excludes programming question when user has reached the limit', async () => {
    // Reach limit
    for (let i = 0; i < MAX_SUBMISSIONS_PER_DAY; i++) 
    {
      await insertProgrammingResponse(userId, programmingQuestionId);
    }

    const res = await request(app)
      .get('/api/test/topic/Test Topic')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const types = res.body.map(q => q.TYPE);
    // Shouldn't have any programming questions
    expect(types).not.toContain('Programming');
  });

  test('includes at most one programming question regardless of how many exist', async () => {
    // Insert a second published programming question in the same topic
    const secondId = await insertQuestion('Programming', [], { points: 2.00 });
    await pool.query(
      `UPDATE Question SET IS_PUBLISHED = 1, SUBCATEGORY = 'Test Topic', SECTION = 'A' WHERE ID = ?`,
      [secondId]
    );

    const res = await request(app)
      .get('/api/test/topic/Test Topic')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const programmingQuestions = res.body.filter(q => q.TYPE === 'Programming');
    // Should still not exceed 1 in the set
    expect(programmingQuestions.length).toBeLessThanOrEqual(1);

    // Cleanup
    await pool.query(`DELETE FROM Question WHERE ID = ?`, [secondId]);
  });
});

// Test mock test fetching
// Just like topic practice, if a user has no more daily submissions,
// mock test should not give them a programming question.
// Otherwise, mock test should give the user a maximum
// of one programming question per test.
describe('GET /api/test/mocktest - programming limit', () => {
  test('includes at most one programming question when user is under the limit', async () => {
    const res = await request(app)
      .get('/api/test/mocktest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const programmingQuestions = res.body.questions.filter(q => q.TYPE === 'Programming');
    expect(programmingQuestions.length).toBeLessThanOrEqual(1);
  });

  test('excludes programming questions when user has reached the limit', async () => {
    // Hit limit
    for (let i = 0; i < MAX_SUBMISSIONS_PER_DAY; i++) 
    {
      await insertProgrammingResponse(userId, programmingQuestionId);
    }

    const res = await request(app)
      .get('/api/test/mocktest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const programmingQuestions = res.body.questions.filter(q => q.TYPE === 'Programming');
    // Should never contain one
    expect(programmingQuestions.length).toBe(0);
  });

  // Very important; even if the user can't get a programming
  // question in a mock test, they still need 3 non-programming questions
  // from each of the 4 sections.
  test('still returns 3 questions from each of the 4 sections when programming is excluded', async () => {
    // Hit limit
    for (let i = 0; i < MAX_SUBMISSIONS_PER_DAY; i++) 
    {
      await insertProgrammingResponse(userId, programmingQuestionId);
    }

    const res = await request(app)
      .get('/api/test/mocktest')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    
    // Count up number of questions in each of the 4 sections
    const questionsBySection = res.body.questions.reduce((acc, q) => {
      acc[q.SECTION] = (acc[q.SECTION] || 0) + 1;
      return acc;
    }, {});

    expect(Object.keys(questionsBySection).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(questionsBySection['A']).toBe(3);
    expect(questionsBySection['B']).toBe(3);
    expect(questionsBySection['C']).toBe(3);
    expect(questionsBySection['D']).toBe(3);
  });

  test('returns 401 when no token provided', async () => {
    const res = await request(app)
      .get('/api/test/mocktest');

    expect(res.status).toBe(401);
  });
});
