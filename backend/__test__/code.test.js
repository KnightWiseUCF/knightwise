////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          code.test.js
//  Description:   Unit tests for Judge0-supported coding problems
//
//  Dependencies:  supertest
//                 mysql2 connection pool (server.js)
//                 judge0Service
//                 testHelpers
//                 discordWebhook (mocked)
//                 codeLimits
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const judge0Service = require('../services/judge0Service');
const { TEST_USER, getAuthToken, verifyTestDatabase } = require("./testHelpers");
const { MAX_CODE_BYTES, MAX_SUBMISSIONS_PER_DAY, MAX_TEST_RUNS_PER_PROBLEM } = require('../config/codeLimits'); 
const { AppError } = require('../middleware/errorHandler');

// Mock Discord webhook
jest.mock('../services/discordWebhook', () => ({
  sendNotification: jest.fn().mockResolvedValue(true),
  notifyUserEvent: jest.fn().mockResolvedValue(true),
  notifyError: jest.fn().mockResolvedValue(true),
}));

// Mock Judge0 service
jest.mock('../services/judge0Service', () => {
  // We don't want to mock these though
  const { LANGUAGE_IDS, STATUS_IDS } = jest.requireActual('../services/judge0Service');

  return {
    LANGUAGE_IDS,
    STATUS_IDS,
    submitBatch: jest.fn(),
    pollSubmission: jest.fn()
  };
});

let token;
let testUserId;

// Test setup/teardown
beforeAll(async () => {
  // Extra database safety check
  await verifyTestDatabase(pool);

  // Cleanup
  await pool.query('DELETE FROM Response WHERE USERID IN (SELECT ID FROM User WHERE EMAIL = ?)', [TEST_USER.email]);
  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  await pool.query('DELETE FROM TestRun WHERE USERID IN (SELECT ID FROM User WHERE EMAIL = ?)', [TEST_USER.email]);

  // Get token and set user ID
  token = await getAuthToken();
  const [users] = await pool.query('SELECT ID FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  if (!users || users.length === 0)
  {
    throw new AppError('Test user not found in database', 404, 'User not found.');
  }
  testUserId = users[0].ID;
});

afterEach(async () => {
  jest.clearAllMocks();
  await pool.query('DELETE FROM Response WHERE USERID = ?', [testUserId]);
  await pool.query('DELETE FROM TestRun WHERE USERID = ?', [testUserId]);
});

afterAll(async () => {
  await pool.query('DELETE FROM Response WHERE USERID = ?', [testUserId]);
  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  await pool.query('DELETE FROM TestRun WHERE USERID = ?', [testUserId]);
  try 
  {
    await pool.end();
  } 
  catch (err) 
  {
    console.error("Error closing pool in /code unit test:", err);
  }
});

// Test submitCode route
describe("POST /api/code/submitCode", () => {
  let testProblemId;
  
  beforeAll(async () => {
    // Create test programming question
    const [result] = await pool.query(
      `INSERT INTO Question (QUESTION_TEXT, TYPE, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE)
       VALUES (?, 'Programming', 'Basics', 'I/O', 10.00)`,
      ['Write a program that prints "Hello World".']
    );
    testProblemId = result.insertId;

  // Add test case
  await pool.query(
      `INSERT INTO TestCase (QUESTION_ID, INPUT, EXPECTED_OUTPUT)
       VALUES (?, ?, ?)`,
      [testProblemId, '', 'Hello World']
    );
  });

  afterAll(async () => {
    // Clean up test problem
    await pool.query('DELETE FROM TestCase WHERE QUESTION_ID = ?', [testProblemId]);
    await pool.query('DELETE FROM Question WHERE ID = ?', [testProblemId]);
  });

  // Tests to ensure all fields properly formatted and limits followed
  describe("Validation Tests", () => { 

    test("should require auth token", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .send({
          problemId: testProblemId,
          code: "print('Hello')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    test("should reject missing code field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields.");
    });

    test("should reject empty code field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "   ",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields.");
    });

    test("should reject missing languageId field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello')",
          isTestRun: false
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields.");
    });

    test("should reject code exceeding max code length", async () => {
      const longCode = "a".repeat(MAX_CODE_BYTES + 1);
      
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: longCode,
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Code submission too long.");
    });

    test("should reject code exceeding max daily submissions", async () => {
  
      // Insert max number of daily submissions
      const insertPromises = [];
      for (let i = 0; i < MAX_SUBMISSIONS_PER_DAY; i++) 
      {
        insertPromises.push(
          pool.query(
            `INSERT INTO Response (USERID, PROBLEM_ID, USER_ANSWER, ISCORRECT, POINTS_EARNED, POINTS_POSSIBLE)
            VALUES (?, ?, ?, TRUE, 10, 10)`,
            [testUserId, testProblemId, "print('test')"]
          )
        );
      }
      await Promise.all(insertPromises);

      // Attempt one more submission
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Extra Submission')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });
  
      expect(res.statusCode).toBe(429);
      expect(res.body.message).toBe(`Daily submission limit exceeded.`);
    });
    
    test("should reject invalid language ID", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello')",
          languageId: 999, // Invalid language ID
          isTestRun: false
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Unsupported programming language.");
    });

    test("should reject when problem not found", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: 99999, // Non-existent 
          code: "print('Hello')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Programming question not found.");
    });
  });

  // Code executed successfully, may be right or wrong
  describe("Successful Execution Tests", () => {

    test("should accept correct code and return success", async () => {

      // Mock Judge0 accepted batch submission response
      judge0Service.submitBatch.mockResolvedValue(["mock-token-123"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isTestRun).toBe(false);
      expect(res.body.allPassed).toBe(true);
      expect(res.body.passedTests).toBe(1);
      expect(res.body.totalTests).toBe(1);
      expect(res.body.pointsEarned).toBe(10.00);
      expect(res.body.testResults).toHaveLength(1);
      expect(res.body.testResults[0].passed).toBe(true);
    });
      
    test("should detect wrong output", async () => {

      // Mock Judge0 wrong answer response
      judge0Service.submitBatch.mockResolvedValue(["mock-token-456"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Goodbye World",
        stderr: null,
        time: "0.007",
        memory: 3552
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Goodbye World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isTestRun).toBe(false);
      expect(res.body.allPassed).toBe(false);
      expect(res.body.passedTests).toBe(0);
      expect(res.body.pointsEarned).toBe(0.00);
      expect(res.body.testResults[0].passed).toBe(false);
      expect(res.body.testResults[0].expectedOutput).toBe("Hello World");
      expect(res.body.testResults[0].actualOutput).toBe("Goodbye World");
    });

    test("should save submission to database", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-save"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        time: "0.010",
        memory: 3000
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      // Check database
      const [responses] = await pool.query(
        `SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ? ORDER BY ID DESC LIMIT 1`,
        [testUserId, testProblemId]
      );

      // Note: MySQL decimal columns are represented as strings.
      expect(responses.length).toBe(1);
      expect(responses[0].USER_ANSWER).toBe("print('Hello World')");
      expect(responses[0].ISCORRECT).toBe(1); // All tests passed
      expect(responses[0].POINTS_EARNED).toBe('10.00');
      expect(responses[0].POINTS_POSSIBLE).toBe('10.00');
      expect(res.body.isTestRun).toBe(false);
    });
  });

  // Execution error tests
  describe("Error Handling Tests", () => {

    // Mock Judge0 compilation error response
    test("should handle compilation errors", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-789"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.COMPILATION_ERROR, description: "Compilation Error" },
        stdout: null,
        stderr: "SyntaxError: unexpected EOF",
        compile_output: "SyntaxError",
        time: null,
        memory: null
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello'",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.isTestRun).toBe(false);
      expect(res.body.status).toBe("Compilation Error");
      expect(res.body.error).toContain("SyntaxError");
      expect(res.body.message).toBe("Your code failed to execute. Please check for errors.");

      // Should still be saved to database
      const [responses] = await pool.query(
        'SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ? ORDER BY ID DESC LIMIT 1',
        [testUserId, testProblemId]
      );
      expect(responses.length).toBe(1);
      expect(responses[0].ISCORRECT).toBe(0);
      expect(responses[0].POINTS_EARNED).toBe('0.00');
    });

    test("should handle runtime errors", async () => {

      // Mock Judge0 runtime error response
      judge0Service.submitBatch.mockResolvedValue(["mock-token-999"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.RUNTIME_ERROR_NZEC, description: "Runtime Error (NZEC)" },
        stdout: null,
        stderr: "ZeroDivisionError: division by zero",
        compile_output: null,
        time: null,
        memory: null
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "x = 1/0",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.isTestRun).toBe(false);
      expect(res.body.status).toBe("Runtime Error (NZEC)");
      expect(res.body.error).toContain("ZeroDivisionError");

      // Should still be saved to database
      const [responses] = await pool.query(
        'SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ? ORDER BY ID DESC LIMIT 1',
        [testUserId, testProblemId]
      );
      expect(responses.length).toBe(1);
      expect(responses[0].ISCORRECT).toBe(0);
      expect(responses[0].POINTS_EARNED).toBe('0.00');
    });

    test("should handle Judge0 service failures", async () => {

      // Mock Judge0 server error response
      judge0Service.submitBatch.mockRejectedValue(
        new AppError("Judge0 API unavailable", 502, "Code submission failed.")
      );

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(502);
      expect(res.body.message).toBe("Code submission failed.");

      // Should NOT be saved to database
      const [responses] = await pool.query(
        'SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ? ORDER BY ID DESC LIMIT 1',
        [testUserId, testProblemId]
      );
      expect(responses.length).toBe(0);
    });
  });

  // Verify batch submission functionality
  describe("Multi-Test Case Tests", () => {
    
    let multiTestProblemId;

    beforeAll(async () => {
      // Create problem with multiple test cases
      const [problemResult] = await pool.query(
        `INSERT INTO Question (QUESTION_TEXT, TYPE, CATEGORY, SUBCATEGORY, POINTS_POSSIBLE)
         VALUES (?, 'Programming', 'Math', 'Prime Numbers', 10.00)`,
        ['Write a function to check if a number is prime']
      );
      multiTestProblemId = problemResult.insertId;
      
      // Add 5 test cases
      await pool.query(
        `INSERT INTO TestCase (QUESTION_ID, INPUT, EXPECTED_OUTPUT) VALUES
         (?, '2', 'True'),
         (?, '17', 'True'),
         (?, '4', 'False'),
         (?, '1', 'False'),
         (?, '97', 'True')`,
        [multiTestProblemId, multiTestProblemId, multiTestProblemId, multiTestProblemId, multiTestProblemId]
      );
    });

    afterAll(async () => {
      await pool.query('DELETE FROM TestCase WHERE QUESTION_ID = ?', [multiTestProblemId]);
      await pool.query('DELETE FROM Question WHERE ID = ?', [multiTestProblemId]);
    });

    test("should pass all test cases and award full points", async () => {
      
      // Mock 5 successful test case results
      judge0Service.submitBatch.mockResolvedValue([
        "token-1", "token-2", "token-3", "token-4", "token-5"
      ]);
      
      judge0Service.pollSubmission
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True",
          time: "0.010",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True",
          time: "0.012",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "False",
          time: "0.011",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "False",
          time: "0.009",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True",
          time: "0.013",
          memory: 3000
        });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: multiTestProblemId,
          code: "def is_prime(n): ...",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allPassed).toBe(true);
      expect(res.body.passedTests).toBe(5);
      expect(res.body.totalTests).toBe(5);
      expect(res.body.pointsEarned).toBe(10.00);
      expect(res.body.testResults).toHaveLength(5);
    });

    test("should award partial credit when some tests fail", async () => {
      judge0Service.submitBatch.mockResolvedValue([
        "token-1", "token-2", "token-3", "token-4", "token-5"
      ]);
      
      // 3 out of 5 test cases pass
      judge0Service.pollSubmission
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True",
          time: "0.010",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True",
          time: "0.012",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "True", // Wrong (should be False)
          time: "0.011",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "False",
          time: "0.009",
          memory: 3000
        })
        .mockResolvedValueOnce({
          status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
          stdout: "False", // Wrong (should be True)
          time: "0.013",
          memory: 3000
        });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: multiTestProblemId,
          code: "def is_prime(n): ...",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allPassed).toBe(false);
      expect(res.body.passedTests).toBe(3);
      expect(res.body.totalTests).toBe(5);
      expect(res.body.pointsEarned).toBe(6.00); // 3/5 * 10 = 6
      
      // Check individual test results
      expect(res.body.testResults[0].passed).toBe(true);
      expect(res.body.testResults[1].passed).toBe(true);
      expect(res.body.testResults[2].passed).toBe(false);
      expect(res.body.testResults[3].passed).toBe(true);
      expect(res.body.testResults[4].passed).toBe(false);
    });

    test("should award zero points when all tests fail", async () => {
      judge0Service.submitBatch.mockResolvedValue(["token-1", "token-2", "token-3", "token-4", "token-5"]);
      
      // All wrong outputs
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Wrong",
        time: "0.010",
        memory: 3000
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: multiTestProblemId,
          code: "def is_prime(n): return 'Wrong'",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allPassed).toBe(false);
      expect(res.body.passedTests).toBe(0);
      expect(res.body.totalTests).toBe(5);
      expect(res.body.pointsEarned).toBe(0.00);
    });
  });

  // Test all KnightWise-supported languages 
  describe("Multi-Language Support", () => {
    const languageTests = [
      {
        name: "Python",
        languageId: judge0Service.LANGUAGE_IDS.PYTHON,
        code: "print('Hello World')",
        expectedOutput: "Hello World"
      },
      {
        name: "C",
        languageId: judge0Service.LANGUAGE_IDS.C,
        code: '#include <stdio.h>\nint main() { printf("Hello World"); return 0; }',
        expectedOutput: "Hello World"
      },
      {
        name: "C++",
        languageId: judge0Service.LANGUAGE_IDS.CPP,
        code: '#include <iostream>\nint main() { std::cout << "Hello World"; return 0; }',
        expectedOutput: "Hello World"
      },
      {
        name: "Java",
        languageId: judge0Service.LANGUAGE_IDS.JAVA,
        code: 'public class Main { public static void main(String[] args) { System.out.println("Hello World"); } }',
        expectedOutput: "Hello World"
      }
    ];

    // Parameterized test, test each language
    test.each(languageTests)("should execute $name code", async ({ name, languageId, code, expectedOutput }) => {

      // Mock Judge0 success response
      judge0Service.submitBatch.mockResolvedValue([`mock-token-${name}`]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: expectedOutput,
        stderr: null,
        time: "0.010",
        memory: 4096
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: code,
          languageId: languageId,
          isTestRun: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allPassed).toBe(true);
    });
  });

  // Test "Test Run" feature, which doesn't grade and store as response,
  // instead stores as test run and returns execution output
  describe("Test Run Tests", () => {

    test("should return stdout without grading or saving a Response", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-testrun"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isTestRun).toBe(true);
      expect(res.body.stdout).toBe("Hello World");
      expect(res.body.status).toBe("Accepted");

      // Should NOT have grading fields
      expect(res.body.allPassed).toBeUndefined();
      expect(res.body.pointsEarned).toBeUndefined();
      expect(res.body.testResults).toBeUndefined();

      // Should NOT have saved a Response
      const [responses] = await pool.query(
        'SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ?',
        [testUserId, testProblemId]
      );
      expect(responses.length).toBe(0);
    });

    test("should save a TestRun entry to the database", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-testrun-db"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      const [testRuns] = await pool.query(
        'SELECT * FROM TestRun WHERE USERID = ? AND QUESTION_ID = ?',
        [testUserId, testProblemId]
      );
      expect(testRuns.length).toBe(1);
    });

    test("should only submit first test case to Judge0 on test run", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-firstonly"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      // submitBatch should have only been called with 1 test case
      expect(judge0Service.submitBatch).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ ID: expect.any(Number) })])
      );
      expect(judge0Service.submitBatch.mock.calls[0][2]).toHaveLength(1);
    });

    test("should not count test runs against actual submission limit", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-testrun-no-sub"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      // Do a test run
      await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      // Test run should not save response,
      // therefore won't count toward MAX_SUBMISSIONS_PER_DAY
      const [responses] = await pool.query(
        'SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ?',
        [testUserId, testProblemId]
      );
      expect(responses.length).toBe(0);
    });

    // The reverse of the previous test
    test("should not count actual submissions against test run limit", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-sub-no-testrun"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      // Do an actual submission
      await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: false
        });

      // Actual submission should not save test run,
      // therefore won't count toward MAX_TEST_RUNS_PER_PROBLEM
      const [testRuns] = await pool.query(
        'SELECT * FROM TestRun WHERE USERID = ? AND QUESTION_ID = ?',
        [testUserId, testProblemId]
      );
      expect(testRuns.length).toBe(0);
    });

    test("should reject when test run limit exceeded", async () => {

      // Insert max test runs directly
      const insertPromises = [];
      for (let i = 0; i < MAX_TEST_RUNS_PER_PROBLEM; i++) 
      {
        insertPromises.push(
          pool.query(
            'INSERT INTO TestRun (USERID, QUESTION_ID) VALUES (?, ?)',
            [testUserId, testProblemId]
          )
        );
      }
      await Promise.all(insertPromises);

      // Try one more test run
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      // Limit has been hit!
      expect(res.statusCode).toBe(429);
      expect(res.body.message).toBe("Daily test run limit for this question exceeded.");
    });

    test("should handle compilation errors on test run", async () => {
      judge0Service.submitBatch.mockResolvedValue(["mock-token-compile-err"]);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.COMPILATION_ERROR, description: "Compilation Error" },
        stdout: null,
        stderr: "SyntaxError: unexpected EOF",
        compile_output: "SyntaxError",
        time: null,
        memory: null
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello'",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON,
          isTestRun: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.isTestRun).toBe(true);

      // Should still be saved to database
      const [testRuns] = await pool.query(
        'SELECT * FROM TestRun WHERE USERID = ? AND QUESTION_ID = ?',
        [testUserId, testProblemId]
      );
      expect(testRuns.length).toBe(1);
    });

    test("should reject missing isTestRun field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
          // No isTestRun field...
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields.");
    });
  });
});
