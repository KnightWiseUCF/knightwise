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
//
////////////////////////////////////////////////////////////////

const bcrypt = require('bcryptjs');
const request = require('supertest');
const { app, pool, poolReady } = require('../server');
const { validTestDBs } = require('../config/env');

// Default test user template, can be overridden for individual tests
const TEST_USER = {
  email: "test@example.com",
  username: "testuser",
  password: "Testpass123!",
  firstName: "Test",
  lastName: "User"
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
  validTestDBs,
  TEST_USER,
  getAuthToken,
  verifyTestDatabase
};