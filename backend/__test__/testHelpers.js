////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          testHelpers.js
//  Description:   Shared utilities for test files
//
//  Dependencies:  bcryptjs
//                 supertest
//                 mysql2 connection pool (server.js)
//                 env config
//                 itemConfig
//
////////////////////////////////////////////////////////////////

const bcrypt = require('bcryptjs');
const request = require('supertest');
const { app, pool, poolReady } = require('../server');
const { validTestDBs } = require('../config/env');
const { ITEM_TYPES } = require('../../shared/itemConfig');

// Default test user template, can be overridden for individual tests
const TEST_USER = {
  email: "test@example.com",
  username: "testuser",
  password: "Testpass123!",
  firstName: "Test",
  lastName: "User"
};

// Default test professor template, can be overridden for individual tests
const TEST_PROF = {
  email:     "testprof@ucf.edu",
  username:  "testprofessor",
  password:  "Testpass123!",
  firstName: "Test",
  lastName:  "Professor"
};

/**
 * Fetches a valid Guild name through the name generation endpoint
 * Use this for Guild tests that require a name token
 *
 * @param {string} token - User token to call generate endpoint with
 * @returns {Promise<{ name: string, nameToken: string }>} Guild name and valid name token
 */
const getValidGuildName = async (token) => {
  const res = await request(app)
    .get('/api/guilds/name/generate')
    .set('Authorization', `Bearer ${token}`);

  return res.body;
};

/**
 * Inserts a Response row with the specified parameters
 * Use this for adding deterministic test data for analytics/stats tests
 * Does NOT trigger grading, currency awarding, or any other side effects
 *
 * @param {number}      userId         - User ID
 * @param {number}      questionId     - Question ID
 * @param {number}      pointsEarned   - Points earned. Default 0
 * @param {number}      pointsPossible - Points possible. Default 1
 * @param {boolean}     isCorrect      - Whether correct. Default false
 * @param {number|null} elapsedTime    - Elapsed time in seconds. Default null
 * @param {string}      topic          - Topic/subcategory. Default 'Arrays'
 * @param {string}      category       - Category. Default 'Introductory Programming'
 * @returns {Promise<number>} Inserted response ID
 */
const insertResponse = async (userId, questionId, { pointsEarned = 0, pointsPossible = 1, isCorrect = false, elapsedTime = null, topic = 'Arrays', category = 'Introductory Programming' } = {}) => {
  const [result] = await pool.query(
    `INSERT INTO Response
     (USERID, PROBLEM_ID, POINTS_EARNED, POINTS_POSSIBLE, ISCORRECT, ELAPSED_TIME, TOPIC, CATEGORY, DATETIME)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [userId, questionId, pointsEarned, pointsPossible, isCorrect ? 1 : 0, elapsedTime, topic, category]
  );
  return result.insertId;
};

/**
 * Inserts a generic user with the specified parameters
 * NOTE: Avoid inserting multiple users with duplicate info
 *       that should be unique (email, username)
 * @param {string}  firstName       - First name of the user to insert. Default 'Generic'
 * @param {string}  lastName        - First name of the user to insert. Default 'User'
 * @param {string}  username        - Username of the user to insert. Default 'genericuser'
 * @param {string}  password        - Password of the user to insert. Default 'genericpassword'
 * @param {string}  email           - Email of the user to insert. Default 'generic@gmail.com'
 * @param {boolean} isProf          - Whether the inserted user is a professor. Default false
 * @param {boolean} verified        - If isProf = true, whether the inserted professor is verified. Default false
 * @param {number}  lifetimeExp     - Lifetime exp of the user to insert. Default 0
 * @param {number}  weeklyExp       - Weekly exp of the user to insert. Default 0
 * @param {number}  dailyExp        - Daily exp of the user to insert. Default 0
 * @param {number}  coins           - Coin balance of the user to insert. Default 0
 * @param {boolean} isSharingStats  - Whether user is opted in to share stats to the aggregate pool. Default false
 * @returns {Promise<number>} Inserted user ID
 */
const insertUser = async ({ firstName = 'Generic', lastName = 'User', username = 'genericuser', password = 'genericpassword', email = 'generic@gmail.com', isProf = false, verified = false, lifetimeExp = 0, weeklyExp = 0, dailyExp = 0, coins = 0, isSharingStats = false } = {}) => {

  // Insert generic user from provided or overridden arguments
  const [result] = await pool.query(
    `INSERT INTO User (FIRSTNAME, LASTNAME, USERNAME, PASSWORD, EMAIL, IS_PROF, VERIFIED, LIFETIME_EXP, WEEKLY_EXP, DAILY_EXP, COINS, IS_SHARING_STATS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [firstName, lastName, username, password, email, isProf ? 1 : 0, verified ? 1 : 0, lifetimeExp, weeklyExp, dailyExp, coins, isSharingStats ? 1 : 0]
  );

  return result.insertId;
};

/**
 * Inserts a guild with the specified parameters
 * @param {string}  name        - Name of the guild to insert. Default 'Ancient Wolves'
 * @param {number}  ownerId     - ID of user to make owner of the guild. Default null
 * @param {number}  lifetimeExp - Lifetime exp of the guild. Default 0
 * @param {number}  weeklyExp   - Weekly exp of the guild. Default 0
 * @param {number}  coins       - Total coin bank of the guild. Default 0
 * @param {number}  dailyExp    - Daily exp of the guild. Default 0
 * @param {boolean} isOpen      - Whether guild is accepting requests to join. Default false
 * @returns {Promise<number>} Inserted guild ID
 */
const insertGuild = async ({ name = 'Ancient Wolves', ownerId = null, lifetimeExp = 0, weeklyExp = 0, coins = 0, dailyExp = 0, isOpen = false } = {}) => {

  // OWNER_ID can't be null, you actually have to give that
  if (ownerId === null)
  {
    throw new Error('insertGuild() requires an ownerId');
  }

  const [result] = await pool.query(
    `INSERT INTO Guild (NAME, OWNER_ID, LIFETIME_EXP, WEEKLY_EXP, COINS, DAILY_EXP, IS_OPEN)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, ownerId, lifetimeExp, weeklyExp, coins, dailyExp, isOpen]
  );

  return result.insertId;
};

/**
 * Inserts a guild AND its owner's GuildMember row atomically
 * Use this instead of insertGuild when you need the owner to
 * pass assertGuildRole checks.
 *
 * @param {number} ownerId  - User ID of the guild owner
 * @param {Object} options  - Same options as insertGuild
 * @returns {Promise<number>} Inserted guild ID
 */
const insertGuildWithOwner = async (ownerId, options = {}) => {
  const guildId = await insertGuild({ ...options, ownerId });
  await pool.query(
    'INSERT INTO GuildMember (USER_ID, GUILD_ID, ROLE) VALUES (?, ?, ?)',
    [ownerId, guildId, 'Owner']
  );
  return guildId;
};

/**
 * Inserts a GuildMember row directly.
 * Use for adding membership state in guild tests.
 *
 * @param {number} userId  - User ID
 * @param {number} guildId - Guild ID
 * @param {string} role    - 'Member' | 'Officer' | 'Owner'
 * @returns {Promise<void>}
 */
const insertGuildMember = async (userId, guildId, role = 'Member') => {
  await pool.query(
    'INSERT INTO GuildMember (USER_ID, GUILD_ID, ROLE) VALUES (?, ?, ?)',
    [userId, guildId, role]
  );
};

/**
 * Inserts a store item and purchase for it, optionally equips
 * @param {number} userId      - User to purchase for
 * @param {Object} itemInfo    - Optional store item info, default fields used otherwise
 * @param {boolean} isEquipped - If true, equips new item for user, false by default
 * @returns {Promise<number>} Inserted item ID
 */
const insertPurchase = async (userId, itemInfo = {}, isEquipped = false) => {
  const [itemResult] = await pool.query(
    'INSERT INTO StoreItem (TYPE, COST, NAME) VALUES (?, ?, ?)',
    [itemInfo.type ?? ITEM_TYPES.FLAIR, itemInfo.cost ?? 5.00, itemInfo.name ?? 'Test Flair']
  );
  const itemId = itemResult.insertId;

  await pool.query(
    'INSERT INTO Purchase (USER_ID, ITEM_ID, IS_EQUIPPED) VALUES (?, ?, ?)',
    [userId, itemId, isEquipped ? 1 : 0]
  );

  return itemId;
};

/**
 * Inserts a question and its answers, returns question ID.
 * @param {string}        type        - Question.TYPE (e.g. 'Multiple Choice')
 * @param {Array<Object>} answers     - Array of { text, isCorrect, rank, placement }
 * @param {number}        points      - Number of points question is worth, default 2.00
 * @param {boolean=true}  isPublished - True inserts as published, false inserts as draft. True by default.
 * @param {number=null}   ownerId     - Question.OWNER_ID to insert. Null by default.
 * @param {string}        subcategory - Question.SUBCATEGORY to insert. 'Arrays' by default.
 * @returns {Promise<number>}           Inserted question ID
 */
const insertQuestion = async (type, answers = [], { points = 2.00, isPublished = true, ownerId = null, subcategory = 'Arrays' } = {}) => {
  const [result] = await pool.query(
    'INSERT INTO Question (QUESTION_TEXT, TYPE, SUBCATEGORY, SECTION, CATEGORY, POINTS_POSSIBLE, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['Test question', type, subcategory, 'A', 'Introductory Programming', points, isPublished ? 1 : 0, ownerId]
  );
  const questionId = result.insertId;

  for (const answer of answers)
  {
    await pool.query(
      'INSERT INTO AnswerText (QUESTION_ID, `TEXT`, IS_CORRECT_ANSWER, `RANK`, PLACEMENT) VALUES (?, ?, ?, ?, ?)',
      [questionId, answer.text, answer.isCorrect ? 1 : 0, answer.rank ?? 0, answer.placement ?? '']
    );
  }

  return questionId;
};

/**
 * Submits an answer and returns response + stored Response database row.
 */
const submitAndFetch = async (questionId, userAnswer, token) => {
  const res = await request(app)
    .post('/api/test/submit')
    .set('Authorization', `Bearer ${token}`)
    .send({
      problem_id: questionId,
      userAnswer,
      category:   'Introductory Programming',
      topic:      'Arrays',
    });

  const [rows] = await pool.query(
    'SELECT USER_ANSWER FROM Response ORDER BY ID DESC LIMIT 1'
  );

  return { res, stored: rows[0] ? JSON.parse(rows[0].USER_ANSWER) : null };
};

/**
 * Get a JWT auth token for the test user
 * Creates the user if it doesn't exist, then logs in.
 *
 * @returns {Promise<string>} - JWT token
 */
async function getAuthToken() 
{
  const hashedPass = await bcrypt.hash(TEST_USER.password, 10);

  // Create test user
  // If already exist, just update
  await pool.query(
    `INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE PASSWORD = VALUES(PASSWORD)`,
    [TEST_USER.username, TEST_USER.email, hashedPass, TEST_USER.firstName, TEST_USER.lastName]
  );

  // Login to get token
  const res = await request(app)
    .post("/api/auth/login")
    .send({
      username: TEST_USER.username,
      password: TEST_USER.password
    });

  if (!res.body.token) 
  {
    throw new Error("Failed to get auth token: " + JSON.stringify(res.body));
  }

  return res.body.token;
}

/**
 * Get a JWT auth token for the test professor
 * Creates the professor if it doesn't exist, then logs in.
 * Professor is inserted as verified so login is permitted.
 *
 * @returns {Promise<string>} - JWT token
 */
async function getProfAuthToken()
{
  const hashedPass = await bcrypt.hash(TEST_PROF.password, 10);

  await pool.query(
    `INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, IS_PROF, VERIFIED)
     VALUES (?, ?, ?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE PASSWORD = VALUES(PASSWORD)`,
    [TEST_PROF.username, TEST_PROF.email, hashedPass, TEST_PROF.firstName, TEST_PROF.lastName]
  );

  const res = await request(app)
    .post("/api/auth/login")
    .send({
      username: TEST_PROF.username,
      password: TEST_PROF.password
    });

  if (!res.body.token)
  {
    throw new Error("Failed to get prof auth token: " + JSON.stringify(res.body));
  }

  return res.body.token;
}

/**
 * Verifies connection to test database, exits if wrong database
 * !!! CALL THIS IN beforeAll() OF EVERY TEST FILE !!!
 * 
 * @param {Object} pool - MySQL connection pool from server.js
 * @returns {Promise<void>}
 */
async function verifyTestDatabase(pool) 
{
  await poolReady;

  const [records] = await pool.query('SELECT DATABASE() as db');
  const currentDB = records[0].db;
  
  if (!validTestDBs.includes(currentDB)) 
  {
    console.error('##############################################');
    console.error('   CRITICAL ERROR: WRONG TESTING DATABASE');
    console.error(`   Expected one of: ${validTestDBs.join(', ')}`);
    console.error(`   Connected to: ${currentDB}`);
    console.error('   STOPPING TESTS IMMEDIATELY');
    console.error('##############################################');
    await pool.end();
    process.exit(1);
  }
  
  console.log(`Database check passed: Using ${currentDB}`);
}

module.exports = {
  TEST_USER,
  TEST_PROF,
  getValidGuildName,
  insertResponse,
  insertUser,
  insertGuild,
  insertGuildWithOwner,
  insertGuildMember,
  insertPurchase,
  insertQuestion,
  submitAndFetch,
  getAuthToken,
  getProfAuthToken,
  verifyTestDatabase
};