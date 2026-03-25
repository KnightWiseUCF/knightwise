////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          stats.test.js
//  Description:   Integration tests for aggregate stats routes:
//                 GET /api/stats/aggregate
//                 GET /api/stats/aggregate/:questionId
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const {
        verifyTestDatabase,
        getAuthToken,
        getProfAuthToken,
        insertUser,
        insertQuestion,
        insertResponse,
      } = require('./testHelpers');

let studentToken;
let profToken;
let adminToken;
let questionId;

// Opted-in user IDs for stats tests
let optedInUserIds  = [];
// Opted-out user ID for filtering tests
let optedOutUserId;
// Response IDs for cleanup
let responseIds = [];

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');

  studentToken = await getAuthToken();
  profToken    = await getProfAuthToken();
  adminToken   = process.env.ADMIN_KEY;

  // Insert a published question to attach responses to
  questionId = await insertQuestion('Multiple Choice', [
    { text: 'Correct', isCorrect: true,  rank: 1, placement: '' },
    { text: 'Wrong',   isCorrect: false, rank: 2, placement: '' },
  ], { points: 2.00, isPublished: true });

  // Insert opted-in users with known response data
  // User A: perfect score, fast
  const userAId = await insertUser({
    username: 'optedin_a',
    email:    'optedin_a@test.com',
    isSharingStats: true,
  });
  optedInUserIds.push(userAId);
  responseIds.push(await insertResponse(userAId, questionId, {
    pointsEarned:   2,
    pointsPossible: 2,
    isCorrect:      true,
    elapsedTime:    30,
    topic:          'Arrays',
  }));

  // User B: half score, medium time
  const userBId = await insertUser({
    username: 'optedin_b',
    email:    'optedin_b@test.com',
    isSharingStats: true,
  });
  optedInUserIds.push(userBId);
  responseIds.push(await insertResponse(userBId, questionId, {
    pointsEarned:   1,
    pointsPossible: 2,
    isCorrect:      false,
    elapsedTime:    60,
    topic:          'Arrays',
  }));

  // User C: zero score, slow, opted-in, tests median skew time resistance
  const userCId = await insertUser({
    username: 'optedin_c',
    email:    'optedin_c@test.com',
    isSharingStats: true,
  });
  optedInUserIds.push(userCId);
  responseIds.push(await insertResponse(userCId, questionId, {
    pointsEarned:   0,
    pointsPossible: 2,
    isCorrect:      false,
    elapsedTime:    290,
    topic:          'Arrays',
  }));

  // Opted-out user: should never appear in aggregate results
  optedOutUserId = await insertUser({
    username: 'optedout',
    email:    'optedout@test.com',
    isSharingStats: false,
  });
  responseIds.push(await insertResponse(optedOutUserId, questionId, {
    pointsEarned:   2,
    pointsPossible: 2,
    isCorrect:      true,
    elapsedTime:    10,
    topic:          'Arrays',
  }));
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error('Error closing pool in stats.test.js:', err);
  }
});

// Test aggregate stats across all questions
describe('GET /api/stats/aggregate', () => {

  test('200 - professor can access aggregate stats', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - admin can access aggregate stats', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - response shape is correct', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('medianAccuracy');
    expect(res.body).toHaveProperty('medianElapsedTime');
    expect(res.body).toHaveProperty('responseCount');
    expect(res.body).toHaveProperty('subcategoryBreakdown');
  });

  test('200 - only includes opted-in users', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    // 3 opted-in users, 1 opted-out, should only count 3
    expect(res.body.responseCount).toBe(3);
  });

  test('200 - median accuracy computed correctly', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    // Accuracies: 1.0, 0.5, 0.0
    // Sorted: [0.0, 0.5, 1.0]
    // So median would be 0.5
    expect(res.status).toBe(200);
    expect(res.body.medianAccuracy).toBeCloseTo(0.5, 5);
  });

  test('200 - median elapsed time computed correctly', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    // Elapsed times: 30, 60, 290
    // Sorted: [30, 60, 290]
    // So median would be 60
    expect(res.status).toBe(200);
    expect(res.body.medianElapsedTime).toBe(60);
  });

  test('200 - subcategory breakdown present and correct', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.subcategoryBreakdown).toHaveProperty('Arrays');
    expect(res.body.subcategoryBreakdown['Arrays']).toHaveProperty('medianAccuracy');
    expect(res.body.subcategoryBreakdown['Arrays']).toHaveProperty('medianElapsedTime');
    expect(res.body.subcategoryBreakdown['Arrays']).toHaveProperty('responseCount', 3);
  });

  test('200 - returns nulls and empty breakdown when no opted-in responses exist', async () => {
    // Temporarily opt everyone out
    await pool.query(
      'UPDATE User SET IS_SHARING_STATS = 0 WHERE ID IN (?)',
      [optedInUserIds]
    );

    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.medianAccuracy).toBeNull();
    expect(res.body.medianElapsedTime).toBeNull();
    expect(res.body.responseCount).toBe(0);
    expect(res.body.subcategoryBreakdown).toEqual({});

    // Opt them back in
    await pool.query(
      'UPDATE User SET IS_SHARING_STATS = 1 WHERE ID IN (?)',
      [optedInUserIds]
    );
  });

  test('200 - null elapsed times excluded from median elapsed time', async () => {
    // Insert a response with null elapsed time from an opted-in user
    const nullTimeUserId = await insertUser({
      username: 'nulltime_user',
      email:    'nulltime@test.com',
      isSharingStats: true,
    });
    optedInUserIds.push(nullTimeUserId);

    const nullTimeResponseId = await insertResponse(nullTimeUserId, questionId, {
      pointsEarned:   1,
      pointsPossible: 2,
      elapsedTime:    null, // explicitly null
      topic:          'Arrays',
    });
    responseIds.push(nullTimeResponseId);

    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${profToken}`);

    // medianElapsedTime should still be computable from the non-null values
    expect(res.status).toBe(200);
    expect(res.body.medianElapsedTime).not.toBeNull();

    // Cleanup
    await pool.query('DELETE FROM User WHERE ID = ?', [nullTimeUserId]);
  });

  test('403 - student cannot access aggregate stats', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate');

    expect(res.status).toBe(401);
  });

});

// Test aggregate stats for a single question
describe('GET /api/stats/aggregate/:questionId', () => {

  test('200 - professor can access per-question stats', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - admin can access per-question stats', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - response shape is correct', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('questionId', questionId);
    expect(res.body).toHaveProperty('medianAccuracy');
    expect(res.body).toHaveProperty('medianElapsedTime');
    expect(res.body).toHaveProperty('responseCount');
  });

  test('200 - only includes opted-in users', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.responseCount).toBe(3);
  });

  test('200 - median accuracy computed correctly for question', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    // Same three opted-in responses: accuracies 1.0, 0.5, 0.0, median 0.5
    expect(res.body.medianAccuracy).toBeCloseTo(0.5, 5);
  });

  test('200 - median elapsed time computed correctly for question', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    // Elapsed: 30, 60, 290, median 60
    expect(res.body.medianElapsedTime).toBe(60);
  });

  test('200 - returns nulls when no opted-in responses for question', async () => {
    // Insert a question that nobody answered
    const unansweredQuestionId = await insertQuestion('Multiple Choice', [
      { text: 'A', isCorrect: true, rank: 1, placement: '' },
    ], { points: 1.00, isPublished: true });

    const res = await request(app)
      .get(`/api/stats/aggregate/${unansweredQuestionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.medianAccuracy).toBeNull();
    expect(res.body.medianElapsedTime).toBeNull();
    expect(res.body.responseCount).toBe(0);

    // Cleanup
    await pool.query('DELETE FROM Question WHERE ID = ?', [unansweredQuestionId]);
  });

  test('200 - scoped to question, does not bleed across questions', async () => {
    // Insert a second question and response for an opted-in user
    const secondQuestionId = await insertQuestion('Multiple Choice', [
      { text: 'A', isCorrect: true, rank: 1, placement: '' },
    ], { points: 2.00, isPublished: true });

    const secondResponseId = await insertResponse(optedInUserIds[0], secondQuestionId, {
      pointsEarned:   2,
      pointsPossible: 2,
      isCorrect:      true,
      elapsedTime:    10,
      topic:          'Strings',
    });

    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    // responseCount should still be 3, not 4
    expect(res.body.responseCount).toBe(3);

    await pool.query('DELETE FROM Question WHERE ID = ?', [secondQuestionId]);
  });

  test('400 - invalid question ID', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate/abc')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(400);
  });

  test('400 - non-positive question ID', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate/-1')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(400);
  });

  test('404 - question does not exist', async () => {
    const res = await request(app)
      .get('/api/stats/aggregate/999999')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(404);
  });

  test('403 - student cannot access per-question stats', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get(`/api/stats/aggregate/${questionId}`);

    expect(res.status).toBe(401);
  });
});
