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
const { MAX_CODE_BYTES, MAX_SUBMISSIONS_PER_DAY } = require('../config/codeLimits'); 
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
});

afterAll(async () => {
  await pool.query('DELETE FROM Response WHERE USERID = ?', [testUserId]);
  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          code: "print('Hello')"
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
            `INSERT INTO Response (USERID, PROBLEM_ID, CODE, ISCORRECT, POINTS_EARNED, POINTS_POSSIBLE)
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: 999 // Invalid language ID
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
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

      await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${token}`)
        .send({
          problemId: testProblemId,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      // Check database
      const [responses] = await pool.query(
        `SELECT * FROM Response WHERE USERID = ? AND PROBLEM_ID = ? ORDER BY ID DESC LIMIT 1`,
        [testUserId, testProblemId]
      );

      // Note: MySQL decimal columns are represented as strings.
      expect(responses.length).toBe(1);
      expect(responses[0].CODE).toBe("print('Hello World')");
      expect(responses[0].ISCORRECT).toBe(1); // All tests passed
      expect(responses[0].POINTS_EARNED).toBe('10.00');
      expect(responses[0].POINTS_POSSIBLE).toBe('10.00');
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("Compilation Error");
      expect(res.body.error).toContain("SyntaxError");
      expect(res.body.message).toBe("Your code failed to execute. Please check for errors.");
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("Runtime Error (NZEC)");
      expect(res.body.error).toContain("ZeroDivisionError");
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(502);
      expect(res.body.message).toBe("Code submission failed.");
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
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
          languageId: languageId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allPassed).toBe(true);
    });
  });
});
