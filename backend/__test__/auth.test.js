////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          auth.test.js
//  Description:   Unit tests for authentication routes.
//
//  Dependencies:  supertest
//                 bcryptjs
//                 node-mailjet (mocked)
//                 discordWebhook (mocked)
//                 mysql2 connection pool (server.js)
//                 testHelpers
//
////////////////////////////////////////////////////////////////

const request = require("supertest");
const bcrypt = require("bcryptjs");
const { app, pool } = require("../server");
const { verifyTestDatabase } = require("./testHelpers");

// Mock Mailjet
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
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

// Test setup/teardown
// Clear test tables before/after each test
beforeAll(async () => {
  // Extra database safety check
  await verifyTestDatabase(pool);

  await pool.query("DELETE FROM User");
  await pool.query("DELETE FROM EmailCode");
});

afterEach(async () => {
  jest.clearAllMocks();
  await pool.query("DELETE FROM User");
  await pool.query("DELETE FROM EmailCode");
});

afterAll(async () => {
  try
  {
    await pool.end();
  }
  catch (err)
  {
    console.error("Error closing pool in /auth unit test:", err);
  }
});

// Test authRoutes.js routes
describe("Auth Routes", () => {

  // sendotp test cases
  test("sendotp -  send OTP for signup", async () => {
    // give: email
    const email = "test1@example.com";

    // when: request /sendotp
    const res = await request(app).post("/api/auth/sendotp").send({
      email,
      purpose: "signup",
    });

    // then: statusCode and message
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Code sent successfully");
  });

  test("sendotp -  fail if email is already registered during signup", async () => {
    // give: registed user
    await pool.query(
      'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
      ["existinguser", "existing@example.com", "123", "Exist", "User"]
    );

    // when
    const res = await request(app).post("/api/auth/sendotp").send({
      email: "existing@example.com",
      purpose: "signup",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Email already registered");
  });

  test("sendotp -  fail if user does not exist during reset", async () => {
    // when
    const res = await request(app).post("/api/auth/sendotp").send({
      email: "unknown@example.com",
      purpose: "reset",
    });

    // then
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  // verify test cases
  test("verify -  verify correct OTP", async () => {
    // give: email, otp
    const email = "test2@example.com";
    const otp = "123456";
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // when: request /verify
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, FALSE)',
      [email, otp, expires] 
    );

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ email, otp });

    // then: statusCode and message
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Email verified successfully");

    const [records] = await pool.query(
      'SELECT IS_VERIFIED FROM EmailCode WHERE EMAIL = ?',
      [email]
    );
    expect(records[0].IS_VERIFIED).toBe(1);
  });

  test("verify -  fail with wrong OTP", async () => {
    // give: correct OTP
    const email = "wrongotp@example.com";
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, FALSE)',
      [email, "999999", new Date(Date.now() + 5 * 60 * 1000)] 
    );

    // when: enter wrong OTP
    const res = await request(app).post("/api/auth/verify").send({
      email,
      otp: "000000",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid OTP");
  });

  test("verify -  fail if OTP expired", async () => {
    // give: expired OTP
    const email = "expiredotp@example.com";
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, FALSE)',
      [email, "123456", new Date(Date.now() - 1000)] 
    );

    // when
    const res = await request(app).post("/api/auth/verify").send({
      email,
      otp: "123456",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("OTP expired");
  });

  test("verify -  fail if no OTP record found", async () => {
    // when
    const res = await request(app).post("/api/auth/verify").send({
      email: "notfound@example.com",
      otp: "000000",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("No record");
  });

  // signup test cases
  test("signup -  succeed if email verified", async () => {
    // give: verified email
    const email = "test3@example.com";
    
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)] 
    );

    // when: request /signup
    const res = await request(app).post("/api/auth/signup").send({
      username: "testuser",
      email,
      password: "Test123!",
      firstName: "New",
      lastName: "User",
    });

    // then: statusCode, message and token
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("User Registered");
    expect(res.body.token).toBeDefined();
  });

  // login test cases
  test("login -  login with correct credentials", async () => {
    // give: registed user
    const password = await bcrypt.hash("testuser1", 10);
    await pool.query(
      'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
      ["testuser1", "testuser1@example.com", password, "Login", "User"]
    );

    // when: request /login
    const res = await request(app).post("/api/auth/login").send({
      username: "testuser1",
      password: "testuser1",
    });

    // then: statusCode, message and token
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("User Logged In");
    expect(res.body.token).toBeDefined();
  });

  // resetPassword test cases
  test("resetPassword -  reset password after verify", async () => {
    // give: verified email
    const email = "test4@example.com";
    const hashed = await bcrypt.hash("oldpass", 10);
    await pool.query(
      'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
      ["resetuser", email, hashed, "Reset", "User"]
    );

    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)] 
    );

    // when: request /resetPassword
    const res = await request(app).post("/api/auth/resetPassword").send({
      email,
      password: "newpass123",
    });

    // then: statusCode, message and match reset password
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Password reset");

    const [records] = await pool.query(
      'SELECT PASSWORD FROM User WHERE EMAIL = ?',
      [email]
    );
    const isMatch = await bcrypt.compare("newpass123", records[0].PASSWORD);
    expect(isMatch).toBe(true);
  });
});