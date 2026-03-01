////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          prof.test.js
//  Description:   Unit tests for professor routes.
//
//  Dependencies:  supertest
//                 bcryptjs
//                 jsonwebtoken
//                 discordWebhook (mocked)
//                 mysql2 connection pool (server.js)
//                 testHelpers
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { app, pool } = require('../server');
const { verifyTestDatabase } = require('./testHelpers');

// Mock Discord webhook
const { notifyUserEvent } = require('../services/discordWebhook');
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

/**
 * Helper function, generates a professor JWT for use in protected endpoint tests
 * @param {number} profId - Professor ID
 * @param {string} role   - Role to attach ('professor' or 'admin')
 * @returns {string}      - Signed JWT
 */
const makeProfToken = (profId, role = 'professor') => {
  return jwt.sign(
    { userId: profId, role, verified: true },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * Helper function, inserts verified professor into db and returns ID and token
 * @param {Object} db       - Database connection pool
 * @param {string} username - Professor username
 * @param {string} email    - Professor email address
 * @param {number} verified - 0 or 1
 * @returns {Promise<{profId: number, token: string}>}
 */
const insertProf = async (db, username, email, verified = 1) => {
  const hashed = await bcrypt.hash("testpass123", 10);
  const [result] = await db.query(
    'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, ?)',
    [username, email, hashed, "Test", "Prof", verified]
  );
  const profId = result.insertId;
  const token = makeProfToken(profId);
  return { profId, token };
};

// Test setup/teardown
beforeAll(async () => {
  await verifyTestDatabase(pool);

  // Cleanup
  await pool.query("DELETE FROM Professor");
  await pool.query("DELETE FROM EmailCode");
  await pool.query("DELETE FROM Question");
  await pool.query("DELETE FROM AnswerText");
});

afterEach(async () => {

  // More cleanup
  jest.clearAllMocks();
  await pool.query("DELETE FROM Professor");
  await pool.query("DELETE FROM EmailCode");
  await pool.query("DELETE FROM Question");
  await pool.query("DELETE FROM AnswerText");
});

afterAll(async () => {
  try 
  {
    await pool.end();
  } 
  catch (err) 
  {
    console.error("Error closing pool in /profauth unit test:", err);
  }
});

// Test profAuthRoutes.js routes
describe("Prof Auth Routes", () => {

  // signup test cases
  test("signup - succeed if email verified", async () => {
    // give: verified email in EmailCode
    const email = "prof1@ucf.edu";
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when: request /signup
    const res = await request(app).post("/api/profauth/signup").send({
      username: "profuser1",
      email,
      password: "Test123!",
      firstName: "Jane",
      lastName: "Smith",
    });

    // then: 201, pending verification message, no token (unverified)
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Professor registered, pending admin verification");
    expect(res.body.token).toBeUndefined();

    // confirm VERIFIED = 0 in db
    const [profs] = await pool.query('SELECT VERIFIED FROM Professor WHERE EMAIL = ?', [email]);
    expect(profs[0].VERIFIED).toBe(0);
  });

  test("signup - fail if email not verified", async () => {
    // when: no EmailCode record exists
    const res = await request(app).post("/api/profauth/signup").send({
      username: "profuser2",
      email: "prof2@ucf.edu",
      password: "Test123!",
      firstName: "Jane",
      lastName: "Smith",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Email verification is required");
  });

  test("signup - fail if professor already exists", async () => {
    // give: existing professor
    const email = "prof3@ucf.edu";
    const hashed = await bcrypt.hash("pass", 10);
    await pool.query(
      'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, 0)',
      ["existingprof", email, hashed, "Existing", "Prof"]
    );
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when: same username
    const res = await request(app).post("/api/profauth/signup").send({
      username: "existingprof",
      email,
      password: "Test123!",
      firstName: "Jane",
      lastName: "Smith",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("User or email already exists");
  });

  test("signup - notifies Discord, flags non-edu email", async () => {
    // give: verified non-edu email
    const email = "prof@gmail.com";
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when
    await request(app).post("/api/profauth/signup").send({
      username: "gmailprof",
      email,
      password: "Test123!",
      firstName: "Jane",
      lastName: "Smith",
    });

    // then: webhook called with non-edu flag
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining("(Email not .edu)")
    );
  });

  test("signup - does not flag .edu email in Discord notification", async () => {
    // give: verified .edu email
    const email = "prof@ucf.edu";
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when
    await request(app).post("/api/profauth/signup").send({
      username: "eduprof",
      email,
      password: "Test123!",
      firstName: "Jane",
      lastName: "Smith",
    });

    // then: webhook called WITHOUT non-edu flag
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.not.stringContaining("(Email not .edu)")
    );
  });

  // login test cases
  test("login - succeed with correct credentials and verified account", async () => {
    // give: verified professor
    await insertProf(pool, "loginprof", "loginprof@ucf.edu", 1);

    // when
    const res = await request(app).post("/api/profauth/login").send({
      username: "loginprof",
      password: "testpass123",
    });

    // then: token with professor role
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Professor Logged In");
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.role).toBe('professor');
    expect(decoded.verified).toBe(true);
  });

  test("login - fail if professor not yet verified", async () => {
    // give: unverified professor
    await insertProf(pool, "unverifiedprof", "unverified@ucf.edu", 0);

    // when
    const res = await request(app).post("/api/profauth/login").send({
      username: "unverifiedprof",
      password: "testpass123",
    });

    // then
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Account pending verification.");
  });

  test("login - fail with wrong password", async () => {
    // give: verified professor
    await insertProf(pool, "wrongpassprof", "wrongpass@ucf.edu", 1);

    // when
    const res = await request(app).post("/api/profauth/login").send({
      username: "wrongpassprof",
      password: "wrongpassword",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid credentials.");
  });

  test("login - fail if professor does not exist", async () => {
    // when
    const res = await request(app).post("/api/profauth/login").send({
      username: "ghostprof",
      password: "testpass123",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("User not found");
  });

  // resetPassword test cases
  test("resetPassword - succeed after email verification", async () => {
    // give: verified professor with verified email
    const email = "resetprof@ucf.edu";
    await insertProf(pool, "resetprof", email, 1);
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when
    const res = await request(app).post("/api/profauth/resetPassword").send({
      email,
      password: "newpass456",
    });

    // then: password updated in db
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Password reset");

    const [profs] = await pool.query('SELECT PASSWORD FROM Professor WHERE EMAIL = ?', [email]);
    const isMatch = await bcrypt.compare("newpass456", profs[0].PASSWORD);
    expect(isMatch).toBe(true);
  });

  test("resetPassword - fail if email not verified", async () => {
    // give: professor with no EmailCode record
    await insertProf(pool, "noverifyprof", "noverify@ucf.edu", 1);

    // when
    const res = await request(app).post("/api/profauth/resetPassword").send({
      email: "noverify@ucf.edu",
      password: "newpass456",
    });

    // then
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Email verification required.");
  });

  test("resetPassword - fail if new password same as current", async () => {
    // give: verified professor
    const email = "samepassprof@ucf.edu";
    await insertProf(pool, "samepassprof", email, 1);
    await pool.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, TRUE)',
      [email, "000000", new Date(Date.now() + 5 * 60 * 1000)]
    );

    // when: same password as what insertProf set
    const res = await request(app).post("/api/profauth/resetPassword").send({
      email,
      password: "testpass123",
    });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Your new password cannot be the same as your current password.");
  });

});

// Test adminRoutes.js professor-accessible routes
describe("Admin Routes - Professor Access", () => {

  // createquestion test cases
  test("createquestion - professor can create question under own ID", async () => {
    // give: verified professor with JWT
    const { profId, token } = await insertProf(pool, "questionprof", "question@ucf.edu", 1);

    // when
    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is Python's print function?",
        owner_id: 9999, // should be overridden to profId, can't be spoofed
        is_published: true,
        answer_text: ["printf", "put", "println", "print"],
        answer_correctness: [1, 2, 3, 4],
        answer_rank: [1, 2, 3, 4],
        answer_placement: ['a', 'b', 'c', 'd'],
      });

    // then: question created, owner_id overridden to professor's own ID
    // through use of effectiveOwnerId
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Question added");

    // Expect Discord notification
    expect(notifyUserEvent).toHaveBeenCalledWith(
      expect.stringContaining("New question published")
    );

    const [questions] = await pool.query(
      'SELECT OWNER_ID FROM Question WHERE ID = ?',
      [res.body.questionId]
    );
    expect(questions[0].OWNER_ID).toBe(profId);
  });

  test("createquestion - fail with no token", async () => {
    // when: no auth header
    const res = await request(app)
      .post("/api/admin/createquestion")
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is Python's print function?",
        owner_id: 1,
        is_published: true,
        answer_text: ["printf", "put", "println", "print"],
        answer_correctness: [1, 2, 3, 4],
        answer_rank: [1, 2, 3, 4],
        answer_placement: ['a', 'b', 'c', 'd'],
      });

    // then
    expect(res.statusCode).toBe(401);
  });

  test("createquestion - fail with regular user JWT (no role)", async () => {
    // give: regular user token (no role field)
    const userToken = jwt.sign({ userId: 999 }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // when
    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is Python's print function?",
        owner_id: 1,
        is_published: true,
        answer_text: ["printf", "put", "println", "print"],
        answer_correctness: [1, 2, 3, 4],
        answer_rank: [1, 2, 3, 4],
        answer_placement: ['a', 'b', 'c', 'd'],
      });

    // then
    expect(res.statusCode).toBe(403);
  });

  // THIS TEST MAY NEED TO BE CHANGED IF LENGTH CHECKING IS CHANGED
  test("createquestion - fail if answer arrays are mismatched length", async () => {
    // give: professor token
    const { token } = await insertProf(pool, "mismatchprof", "mismatch@ucf.edu", 1);

    // when: answer_rank has one fewer entry
    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is Python's print function?",
        owner_id: 1,
        is_published: true,
        answer_text: ["printf", "put", "println", "print"],
        answer_correctness: [1, 2, 3, 4],
        answer_rank: [1, 2, 3], // This length doesn't match!
        answer_placement: ['a', 'b', 'c', 'd'],
      });

    // then
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid fields");
  });

  // GET problems/:id test cases
  test("problems/:id - professor can fetch question by ID", async () => {
    // give: professor token and a question in the db
    const { token } = await insertProf(pool, "fetchprof", "fetch@ucf.edu", 1);
    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ["type", 'author', "sec", "cat", "sub", 1.0, "text", null]
    );
    const questionId = result.insertId;

    // when
    const res = await request(app)
      .get(`/api/admin/problems/${questionId}`)
      .set("Authorization", `Bearer ${token}`);

    // then
    expect(res.statusCode).toBe(200);
    expect(res.body.ID).toBe(questionId);
    expect(res.body.answers).toBeDefined();
  });

  // DELETE problems/:id test cases
  test("problems/:id - fail if question does not exist", async () => {
    // give: professor token
    const { token } = await insertProf(pool, "notfoundprof", "notfound@ucf.edu", 1);

    // when
    const res = await request(app)
      .get("/api/admin/problems/999999")
      .set("Authorization", `Bearer ${token}`);

    // then
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  test("problems/:id - fail with no token", async () => {
    // when
    const res = await request(app).get("/api/admin/problems/1");

    // then
    expect(res.statusCode).toBe(401);
  });

  test("DELETE problems/:id - professor can delete own question", async () => {
    const { profId, token } = await insertProf(pool, "deleteprof", "delete@ucf.edu", 1);

    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "To be deleted", profId]
    );

    const res = await request(app)
      .delete(`/api/admin/problems/${result.insertId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Question deleted successfully");

    const [questions] = await pool.query('SELECT * FROM Question WHERE ID = ?', [result.insertId]);
    expect(questions.length).toBe(0);
  });

  test("DELETE problems/:id - professor cannot delete another professor's question", async () => {
    const { profId } = await insertProf(pool, "ownerdelprof", "ownerdel@ucf.edu", 1);
    const { token: attackerToken } = await insertProf(pool, "attackerdel", "attackerdel@ucf.edu", 1);

    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Owner question", profId]
    );

    const res = await request(app)
      .delete(`/api/admin/problems/${result.insertId}`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.statusCode).toBe(403);
  });
});

// Test adminRoutes.js professor-accessible draft and publishing routes
describe("Admin Routes - Draft/Publish", () => {

  test("createquestion - creates as draft when IS_PUBLISHED is false", async () => {
    const { profId, token } = await insertProf(pool, "draftprof", "draft@ucf.edu", 1);

    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is 2 + 2?",
        is_published: false,
        answer_text: ["4", "3"],
        answer_correctness: [1, 0],
        answer_rank: [1, 2],
        answer_placement: ["a", "b"],
      });

    expect(res.statusCode).toBe(201);

    const [questions] = await pool.query(
      'SELECT IS_PUBLISHED FROM Question WHERE ID = ?',
      [res.body.questionId]
    );
    expect(questions[0].IS_PUBLISHED).toBe(0);
  });

  test("createquestion - creates as published when IS_PUBLISHED is true", async () => {
    const { token } = await insertProf(pool, "publishprof", "publish@ucf.edu", 1);

    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is 2 + 2?",
        is_published: true,
        answer_text: ["4", "3"],
        answer_correctness: [1, 0],
        answer_rank: [1, 2],
        answer_placement: ["a", "b"],
      });

    expect(res.statusCode).toBe(201);

    const [questions] = await pool.query(
      'SELECT IS_PUBLISHED FROM Question WHERE ID = ?',
      [res.body.questionId]
    );
    expect(questions[0].IS_PUBLISHED).toBe(1);
  });

  test("createquestion - fails if IS_PUBLISHED not provided", async () => {
    const { token } = await insertProf(pool, "nopubprof", "nopub@ucf.edu", 1);

    const res = await request(app)
      .post("/api/admin/createquestion")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "What is 2 + 2?",
        answer_text: ["4", "3"],
        answer_correctness: [1, 0],
        answer_rank: [1, 2],
        answer_placement: ["a", "b"],
      });

    expect(res.statusCode).toBe(400);
  });

  test("drafts - professor sees only their own drafts", async () => {
    const { profId, token } = await insertProf(pool, "myprof", "myprof@ucf.edu", 1);
    const { profId: otherId } = await insertProf(pool, "otherprof", "other@ucf.edu", 1);

    // Insert one draft for each professor
    await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "My draft", profId]
    );
    await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Other draft", otherId]
    );

    const res = await request(app)
      .get("/api/admin/drafts")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.drafts.length).toBe(1);
    expect(res.body.drafts[0].QUESTION_TEXT).toBe("My draft");
  });

  test("drafts - published questions do not appear in drafts", async () => {
    const { profId, token } = await insertProf(pool, "pubcheckprof", "pubcheck@ucf.edu", 1);

    await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 1, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Published question", profId]
    );

    const res = await request(app)
      .get("/api/admin/drafts")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.drafts.length).toBe(0);
  });

  test("PUT problems/:id - professor can edit own draft", async () => {
    const { profId, token } = await insertProf(pool, "editprof", "edit@ucf.edu", 1);

    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "KnightWise", "DSN", "Programming", "Python", 5.0, "Original text", profId]
    );
    const questionId = result.insertId;

    const res = await request(app)
      .put(`/api/admin/problems/${questionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "Updated text",
        answer_text: ["4", "3"],
        answer_correctness: [1, 0],
        answer_rank: [1, 2],
        answer_placement: ["a", "b"],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Question updated");

    const [questions] = await pool.query('SELECT QUESTION_TEXT FROM Question WHERE ID = ?', [questionId]);
    expect(questions[0].QUESTION_TEXT).toBe("Updated text");
  });

  test("PUT problems/:id - unpublishes published question on edit", async () => {
    const { profId, token } = await insertProf(pool, "unpubprof", "unpub@ucf.edu", 1);

    // Start off as published
    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
      ["MCQ", "KnightWise", "DSN", "Programming", "Python", 5.0, "Published question", profId]
    );
    const questionId = result.insertId;

    await request(app)
      .put(`/api/admin/problems/${questionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "Updated text",
        answer_text: ["4", "3"],
        answer_correctness: [1, 0],
        answer_rank: [1, 2],
        answer_placement: ["a", "b"],
      });

    // No longer published!
    const [questions] = await pool.query('SELECT IS_PUBLISHED FROM Question WHERE ID = ?', [questionId]);
    expect(questions[0].IS_PUBLISHED).toBe(0);
  });

  test("PUT problems/:id - professor cannot edit another professor's question", async () => {
    const { profId } = await insertProf(pool, "ownerprof", "owner@ucf.edu", 1);
    const { token: attackerToken } = await insertProf(pool, "attackerprof", "attacker@ucf.edu", 1);

    // Insert draft question for ownerprof
    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, AUTHOR_EXAM_ID, SECTION, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "KnightWise", "DSN", "Programming", "Python", 5.0, "Owner question", profId]
    );
    const questionId = result.insertId;

    // Have attacker try to edit
    const res = await request(app)
      .put(`/api/admin/problems/${questionId}`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({
        type: "Multiple Choice",
        author_exam_id: "KnightWise",
        section: "DSN",
        category: "Programming",
        subcategory: "Python",
        points_possible: 5.0,
        question_text: "Hacked text",
        answer_text: ["4"],
        answer_correctness: [1],
        answer_rank: [1],
        answer_placement: ["a"],
      });

    expect(res.statusCode).toBe(403);
  });

  test("publish - professor can publish own draft", async () => {
    const { profId, token } = await insertProf(pool, "pubprof", "pub@ucf.edu", 1);

    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Draft question", profId]
    );
    const questionId = result.insertId;

    const res = await request(app)
      .post(`/api/admin/problems/${questionId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Question published");

    const [questions] = await pool.query('SELECT IS_PUBLISHED FROM Question WHERE ID = ?', [questionId]);
    expect(questions[0].IS_PUBLISHED).toBe(1);
  });

  test("publish - fail if already published", async () => {
    const { profId, token } = await insertProf(pool, "alreadypubprof", "alreadypub@ucf.edu", 1);

    // Insert question as published
    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 1, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Already published", profId]
    );

    const res = await request(app)
      .post(`/api/admin/problems/${result.insertId}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Question already published");
  });

  test("publish - professor cannot publish another professor's question", async () => {
    const { profId } = await insertProf(pool, "ownerprof2", "owner2@ucf.edu", 1);
    const { token: attackerToken } = await insertProf(pool, "attackerprof2", "attacker2@ucf.edu", 1);

    // Insert draft question for ownerprof2
    const [result] = await pool.query(
      'INSERT INTO Question (TYPE, SECTION, CATEGORY, SUBCATEGORY, QUESTION_TEXT, IS_PUBLISHED, OWNER_ID) VALUES (?, ?, ?, ?, ?, 0, ?)',
      ["MCQ", "DSN", "Programming", "Python", "Owner draft", profId]
    );

    // Attacker tries to publish it
    const res = await request(app)
      .post(`/api/admin/problems/${result.insertId}/publish`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.statusCode).toBe(403);
  });
});
