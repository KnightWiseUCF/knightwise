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
//
////////////////////////////////////////////////////////////////

const request = require('supertest');
const { app, pool } = require('../server');
const judge0Service = require('../services/judge0Service');
const { TEST_USER, getAuthToken, verifyTestDatabase } = require("./testHelpers");
const { MAX_CODE_BYTES, MAX_SUBMISSIONS_PER_DAY } = require('../config/codeLimits'); 

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
    submitCode: jest.fn(),
    pollSubmission: jest.fn()
  };
});

// Test setup/teardown
beforeAll(async () => {
  // Extra database safety check
  await verifyTestDatabase(pool);

  await pool.query('DELETE FROM User WHERE EMAIL = ?', [TEST_USER.email]);
  // TODO: Add necessary database queries if we store other coding problem info
});

afterEach(async () => {
  jest.clearAllMocks();
});

afterAll(async () => {
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
  
  let authToken;
  
  beforeAll(async () => {
    authToken = await getAuthToken();
  });

  // Tests to ensure all fields properly formatted and limits followed
  describe("Validation Tests", () => { 

    test("should require auth token", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .send({
          problemId: 1,
          code: "print('Hello')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    test("should reject missing code field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    test("should reject empty code field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "   ",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    test("should reject missing languageId field", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Hello')"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Missing required fields");
    });

    test("should reject code exceeding max code length", async () => {
      const longCode = "a".repeat(MAX_CODE_BYTES + 1);
      
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: longCode,
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Code submission too long");
    });

   /*
    *  test("should reject code exceeding max daily submissions", async () => {
    *    // TODO: Have user reach max daily submissions
    *    //       This depends on how we set up the schema for coding questions
    *    //       Possibly just "set User's daily submission fields to max"
    *
    *    // Attempt one more submission
    *    const res = await request(app)
    *      .post("/api/code/submitCode")
    *      .set("Authorization", `Bearer ${authToken}`)
    *      .send({
    *        problemId: 1,
    *        code: "print('Extra Submission')",
    *        languageId: judge0Service.LANGUAGE_IDS.PYTHON
    *      });
    *
    *    expect(res.statusCode).toBe(429);
    *    expect(res.body.message).toBe(`Daily submission limit reached`);
    *  });
    */

    test("should reject invalid language ID", async () => {
      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Hello')",
          languageId: 999 // Invalid language ID
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Unsupported programming language");
    });
  });

  // Code executed successfully, may be right or wrong
  describe("Successful Execution Tests", () => {

    test("should accept correct code and return success", async () => {

      // Mock Judge0 success response
      judge0Service.submitCode.mockResolvedValue("mock-token-123");
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Hello World\n",
        stderr: null,
        time: "0.008",
        memory: 3296
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Hello World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        correct: true,
        stdout: "Hello World\n",
        expectedOutput: "Hello World"
      });
      
      // Verify service was called correctly
      expect(judge0Service.submitCode).toHaveBeenCalledWith(
        "print('Hello World')",
        judge0Service.LANGUAGE_IDS.PYTHON,
        ""
      );
    });

    test("should detect wrong output", async () => {

      // Mock Judge0 wrong answer response
      judge0Service.submitCode.mockResolvedValue("mock-token-456");
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: "Goodbye World\n",
        stderr: null,
        time: "0.007",
        memory: 3552
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Goodbye World')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        correct: false,
        stdout: "Goodbye World\n",
        expectedOutput: "Hello World"
      });
    });
  });

  // Execution error tests
  describe("Error Handling Tests", () => {

    test("should handle syntax errors properly", async () => {

      // Mock Judge0 syntax error response
      judge0Service.submitCode.mockResolvedValue("mock-token-789");
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.RUNTIME_ERROR_NZEC, description: "Runtime Error (NZEC)" },
        stdout: null,
        stderr: "  File \"script.py\", line 2\n    \n                         ^\nSyntaxError: unexpected EOF while parsing\n",
        compile_output: null
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Hello'",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        success: false,
        status: "Runtime Error (NZEC)",
        stderr: expect.stringContaining("SyntaxError")
      });
    });

    test("should handle runtime errors", async () => {

      // Mock Judge0 runtime error response
      judge0Service.submitCode.mockResolvedValue("mock-token-999");
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.RUNTIME_ERROR_NZEC, description: "Runtime Error (NZEC)" },
        stdout: null,
        stderr: "ZeroDivisionError: division by zero",
        compile_output: null
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "x = 1/0",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.stderr).toContain("ZeroDivisionError");
    });

    test("should handle Judge0 service failures", async () => {
      const { AppError } = require("../middleware/errorHandler");
      
      // Mock Judge0 server error response
      judge0Service.submitCode.mockRejectedValue(
        new AppError("Judge0 API unavailable", 502, "Code submission failed")
      );

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: "print('Hello')",
          languageId: judge0Service.LANGUAGE_IDS.PYTHON
        });

      expect(res.statusCode).toBe(502);
      expect(res.body.message).toBe("Code submission failed");
    });
  });

  // Test all KnightWise-supported languages 
  describe("Multi-Language Support", () => {
    const languageTests = [
      {
        name: "Python",
        languageId: judge0Service.LANGUAGE_IDS.PYTHON,
        code: "print('Hello World')",
        expectedOutput: "Hello World\n"
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
      judge0Service.submitCode.mockResolvedValue(`mock-token-${name}`);
      judge0Service.pollSubmission.mockResolvedValue({
        status: { id: judge0Service.STATUS_IDS.ACCEPTED, description: "Accepted" },
        stdout: expectedOutput,
        stderr: null,
        time: "0.010",
        memory: 4096
      });

      const res = await request(app)
        .post("/api/code/submitCode")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          problemId: 1,
          code: code,
          languageId: languageId
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.correct).toBe(true);
    });
  });
});
