////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          problems.test.js
//  Description:   Integration tests for problem/question routes:
//                 GET /api/problems/:id
//                 GET /api/problems
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 testHelpers
//                 paginationConfig
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const {
  verifyTestDatabase,
  getAuthToken,
  getProfAuthToken,
  insertQuestion,
  insertUser,
} = require('./testHelpers');
const { PAGE_SIZES } = require('../config/paginationConfig');

let studentToken;
let profToken;
let adminToken;

// Subcategory names used across tests
const SUB_ARRAYS    = 'Arrays';
const SUB_RECURSION = 'Recursion';
const SUB_SORTING   = 'Sorting';

// Helper to make an AnswerText
const makeAnswer = (text, isCorrect = true) => ({
  text,
  isCorrect,
  rank: 1,
  placement: '',
});

beforeAll(async () => {
  await verifyTestDatabase(pool);
  await pool.query('DELETE FROM User');

  studentToken = await getAuthToken();
  profToken    = await getProfAuthToken();
  adminToken   = process.env.ADMIN_KEY;

  // Insert published questions spread across subcategories
  // Two Arrays, one Recursion, one Sorting
  await insertQuestion('Multiple Choice', [makeAnswer('A')], {
    points: 1, isPublished: true, subcategory: SUB_ARRAYS,
  });
  await insertQuestion('Multiple Choice', [makeAnswer('B')], {
    points: 1, isPublished: true, subcategory: SUB_ARRAYS,
  });
  await insertQuestion('Multiple Choice', [makeAnswer('C')], {
    points: 1, isPublished: true, subcategory: SUB_RECURSION,
  });
  await insertQuestion('Multiple Choice', [makeAnswer('D')], {
    points: 1, isPublished: true, subcategory: SUB_SORTING,
  });

  // One draft (should NEVER appear in results)
  await insertQuestion('Multiple Choice', [makeAnswer('E')], {
    points: 1, isPublished: false, subcategory: SUB_ARRAYS,
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM User');
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error('Error closing pool in problems.test.js:', err);
  }
});

// Test fetching questions by ID
describe('GET /api/problems/:id', () => {

  let publishedQuestionId;
  let draftQuestionId;

  beforeAll(async () => {
    publishedQuestionId = await insertQuestion('Multiple Choice', [makeAnswer('A')], {
      points: 2, isPublished: true, subcategory: SUB_ARRAYS,
    });

    draftQuestionId = await insertQuestion('Multiple Choice', [makeAnswer('B')], {
      points: 2, isPublished: false, subcategory: SUB_ARRAYS,
    });
  });

  test('200 - returns published question with answers attached', async () => {
    const res = await request(app)
      .get(`/api/problems/${publishedQuestionId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ID', publishedQuestionId);
    expect(res.body).toHaveProperty('answers');
    expect(Array.isArray(res.body.answers)).toBe(true);
    expect(res.body.answers.length).toBeGreaterThan(0);
  });

  test('200 - student can access published question', async () => {
    const res = await request(app)
      .get(`/api/problems/${publishedQuestionId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - professor can access published question', async () => {
    const res = await request(app)
      .get(`/api/problems/${publishedQuestionId}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
  });

  test('404 - draft question is not returned', async () => {
    const res = await request(app)
      .get(`/api/problems/${draftQuestionId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  test('404 - question does not exist', async () => {
    const res = await request(app)
      .get('/api/problems/999999')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get(`/api/problems/${publishedQuestionId}`);

    expect(res.status).toBe(401);
  });
});

// Test fetching all published questions
// Access control (admins/professors only)
describe('GET /api/problems - access control', () => {

  test('200 - professor can access', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
  });

  test('200 - admin can access', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('403 - student cannot access', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  test('401 - no auth token', async () => {
    const res = await request(app)
      .get('/api/problems');

    expect(res.status).toBe(401);
  });
});

// Validate JSON response shape
describe('GET /api/problems - response shape', () => {

  test('200 - shape has questions and pagination', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('questions');
    expect(res.body).toHaveProperty('pagination');
  });

  test('200 - pagination shape is correct', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    const { pagination } = res.body;
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('pageSize');
    expect(pagination).toHaveProperty('totalQuestions');
    expect(pagination).toHaveProperty('totalPages');
  });

  test('200 - questions is an object keyed by subcategory, not an array', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(typeof res.body.questions).toBe('object');
    expect(Array.isArray(res.body.questions)).toBe(false);
  });

  test('200 - each subcategory value is an array of question objects with answers', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    for (const questions of Object.values(res.body.questions))
    {
      expect(Array.isArray(questions)).toBe(true);
      for (const q of questions)
      {
        expect(q).toHaveProperty('ID');
        expect(q).toHaveProperty('SUBCATEGORY');
        expect(q).toHaveProperty('answers');
        expect(Array.isArray(q.answers)).toBe(true);
      }
    }
  });
});

// Verify it only fetches published questions
describe('GET /api/problems - published filter', () => {

  test('200 - draft question ID never appears in results', async () => {
    // Insert a fresh draft and confirm its ID is absent from the response
    const draftId = await insertQuestion('Multiple Choice', [makeAnswer('X')], {
      points: 1, isPublished: false, subcategory: SUB_ARRAYS,
    });

    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    const returnedIds = Object.values(res.body.questions)
      .flat()
      .map(q => q.ID);

    expect(returnedIds).not.toContain(draftId);

    // Cleanup — draft has no owner so delete directly by ID
    await pool.query('DELETE FROM Question WHERE ID = ?', [draftId]);
  });
});

// Verify response shape subcategory breakdown
describe('GET /api/problems - subcategory grouping', () => {

  test('200 - questions are grouped under correct subcategory keys', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveProperty(SUB_ARRAYS);
    expect(res.body.questions).toHaveProperty(SUB_RECURSION);
    expect(res.body.questions).toHaveProperty(SUB_SORTING);
  });

  test('200 - each question includes its answers', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    const arraysQuestions = res.body.questions[SUB_ARRAYS];
    expect(Array.isArray(arraysQuestions)).toBe(true);
    expect(arraysQuestions[0].answers.length).toBeGreaterThan(0);
  });
});

// Verify optional subcategory filter query param
describe('GET /api/problems?subcategory=...', () => {

  test('200 - single subcategory filter returns only that subcategory', async () => {
    const res = await request(app)
      .get(`/api/problems?subcategory=${SUB_ARRAYS}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.questions);
    expect(keys).toContain(SUB_ARRAYS);
    expect(keys).not.toContain(SUB_RECURSION);
    expect(keys).not.toContain(SUB_SORTING);
  });

  test('200 - totalQuestions reflects subcategory filter', async () => {
    const res = await request(app)
      .get(`/api/problems?subcategory=${SUB_ARRAYS}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.body.pagination.totalQuestions).toBeGreaterThanOrEqual(2);
    expect(res.body.questions).toHaveProperty(SUB_ARRAYS);
    expect(res.body.questions).not.toHaveProperty(SUB_RECURSION);
    expect(res.body.questions).not.toHaveProperty(SUB_SORTING);
  });

  test('200 - comma-separated subcategories returns only those subcategories', async () => {
    const res = await request(app)
      .get(`/api/problems?subcategory=${SUB_ARRAYS},${SUB_RECURSION}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.questions);
    expect(keys).toContain(SUB_ARRAYS);
    expect(keys).toContain(SUB_RECURSION);
    expect(keys).not.toContain(SUB_SORTING);
  });

  test('200 - subcategory filter is case-insensitive', async () => {
    const res = await request(app)
      .get(`/api/problems?subcategory=${SUB_ARRAYS.toLowerCase()}`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveProperty(SUB_ARRAYS);
  });

  test('200 - returns empty questions object for nonexistent subcategory', async () => {
    const res = await request(app)
      .get('/api/problems?subcategory=NonexistentSubcategory')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions).toEqual({});
    expect(res.body.pagination.totalQuestions).toBe(0);
  });
});

// Verify optional "only questions I own" professor query param
describe('GET /api/problems?mine=true', () => {

  test('200 - mine=true returns only the requesting professor\'s questions', async () => {
    // Insert a question under an owner ID that won't match the test professor
    const otherProfId = await insertUser({
      username:  'other_prof',
      email:     'other_prof@test.com',
      isProf:    true,
      verified:  true,
    });

    await insertQuestion('Multiple Choice', [makeAnswer('Z')], {
      points: 1, isPublished: true, subcategory: SUB_ARRAYS, ownerId: otherProfId,
    });

    const res = await request(app)
      .get('/api/problems?mine=true')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);

    // No returned question should belong to the other professor
    for (const questions of Object.values(res.body.questions))
    {
      for (const q of questions)
      {
        expect(q.OWNER_ID).not.toBe(otherProfId);
      }
    }

    // Cleanup
    await pool.query('DELETE FROM Question WHERE OWNER_ID = ?', [otherProfId]);
    await pool.query('DELETE FROM User WHERE ID = ?', [otherProfId]);
  });

  test('200 - mine=false returns same total as omitting the param', async () => {
    const resOmitted = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    const resFalse = await request(app)
      .get('/api/problems?mine=false')
      .set('Authorization', `Bearer ${profToken}`);

    expect(resOmitted.status).toBe(200);
    expect(resFalse.status).toBe(200);
    expect(resFalse.body.pagination.totalQuestions)
      .toBe(resOmitted.body.pagination.totalQuestions);
  });
});

// Verify pagination
describe('GET /api/problems - pagination', () => {

  test('200 - default page is 1', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.body.pagination.page).toBe(1);
  });

  test('200 - non-numeric page is clamped to 1', async () => {
    const res = await request(app)
      .get('/api/problems?page=abc')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('200 - page 0 is clamped to 1', async () => {
    const res = await request(app)
      .get('/api/problems?page=0')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  test('200 - out-of-range page is clamped to last page', async () => {
    const res = await request(app)
      .get('/api/problems?page=999')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(res.body.pagination.totalPages);
  });

  test('200 - pageSize matches PROF_QUESTIONS config', async () => {
    const res = await request(app)
      .get('/api/problems')
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.body.pagination.pageSize).toBe(PAGE_SIZES.PROF_QUESTIONS);
  });

  test('200 - subcategory and page params work together', async () => {
    const res = await request(app)
      .get(`/api/problems?subcategory=${SUB_ARRAYS}&page=1`)
      .set('Authorization', `Bearer ${profToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(Object.keys(res.body.questions)).toContain(SUB_ARRAYS);
    expect(Object.keys(res.body.questions)).not.toContain(SUB_RECURSION);
  });
});
