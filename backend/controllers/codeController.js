////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          codeController.js
//  Description:   Controller functions for routes/codeSubmission.js.
//
//  Dependencies:  judge0Service
//                 errorHandler
//                 codeLimits
//
////////////////////////////////////////////////////////////////

const judge0Service = require('../services/judge0Service');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { MAX_CODE_BYTES, MAX_SUBMISSIONS_PER_DAY, MAX_TEST_RUNS_PER_PROBLEM } = require('../config/codeLimits'); 

/**
 * Grade test case results, calculate score
 * @param {Array}  results        - Judge0 results from polling
 * @param {Array}  testCases      - Test cases from database
 * @param {number} pointsPossible - Total points for the problem
 * @returns {Object}              - Grading summary and detailed results
 */
const gradeCodeSubmission = (results, testCases, pointsPossible) => {
  let passedTests = 0;
  
  const testResults = results.map((result, index) => {
    const testCase = testCases[index];
    
    // Check if execution succeeded
    const executionSuccess = result.status.id === judge0Service.STATUS_IDS.ACCEPTED;
    
    // Check if output matches
    const outputMatches = executionSuccess && 
      result.stdout?.trim() === testCase.EXPECTED_OUTPUT.trim();
    
    if (outputMatches) passedTests++;
    
    return {
      testCaseId: testCase.ID,
      input: testCase.INPUT,
      expectedOutput: testCase.EXPECTED_OUTPUT,
      actualOutput: result.stdout?.trim() || null,
      passed: outputMatches,
      status: result.status.description,
      executionTime: result.time,
      memory: result.memory,
      error: result.stderr || result.compile_output || null
    };
  });

  // Partial credit for number of test cases passed
  const totalTests = testCases.length;
  const normalizedScore = (totalTests === 0 // Let's not divide by 0
    ? 0.0
    : passedTests/totalTests
  )
  const pointsEarned = normalizedScore * pointsPossible;
  const allPassed = (passedTests === totalTests);

  return {
    passedTests,
    totalTests,
    allPassed,
    pointsEarned,
    testResults
  };
};

/**
 * Checks Judge0 results for compilation or runtime errors
 * @param {Array} results - Judge0 results from polling
 * @returns {boolean}     - True if results have error, false otherwise
 */
const hasError = (results) => {
  // Check for compilation errors
  const hasCompilationError = results.some(r =>
    r.status.id === judge0Service.STATUS_IDS.COMPILATION_ERROR
  );

  // Check for runtime errors
  const hasRuntimeError = results.some(r =>
    r.status.id >= judge0Service.STATUS_IDS.RUNTIME_ERROR_SIGSEGV &&
    r.status.id <= judge0Service.STATUS_IDS.RUNTIME_ERROR_OTHER
  );

  return (hasCompilationError || hasRuntimeError);
}

/**
 * @route   POST /api/codeSubmission/submitCode
 * @desc    Submit code to Judge0, receive output and grade against test cases.
 *          Supports test runs, which submits to Judge0 but doesn't grade output
 *          or store as a response, just runs against first test case, shows output, 
 *          and stores as test run.
 * @access  Protected
 * 
 * @param   {import('express').Request}  req - Express request object
 * @param   {import('express').Response} res - Express response object
 * @returns {Promise<void>}                  - Sends HTTP/JSON response
 */
const submitCode = asyncHandler(async (req, res) => {
  // Code can only be submitted by account owner
  const userId = req.user.id; // Set by authMiddleware.js

  const { problemId, code, languageId, isTestRun } = req.body;

  if (!problemId || !code || !languageId || code.trim().length === 0 || isTestRun === undefined)
  {
    throw new AppError('Empty problemId, code, languageId, or isTestRun', 400, 'Missing required fields.');
  }

  // Check if user code submissions exceeds max size
  if (code.length > MAX_CODE_BYTES) 
  {
    throw new AppError(
      `Code submission too long, exceeds ${MAX_CODE_BYTES} bytes`,
      400,
      'Code submission too long.'
    );
  }
  
  // Ensure KnightWise supports languageId
  const validLanguageIds = Object.values(judge0Service.LANGUAGE_IDS);
  if (!validLanguageIds.includes(languageId))
  {
    throw new AppError(
      `languageId unsupported by KnightWise: ${languageId}`,
      400,
      'Unsupported programming language.'
    );
  }

  // Check appropriate daily limit for either test run or actual submission
  if (isTestRun)
  {
    // Check if user has exceeded max daily test runs for this question
    const [[{ numTestRuns }]] = await req.db.query(
      `SELECT COUNT(*) as numTestRuns FROM TestRun WHERE USERID = ? AND QUESTION_ID = ? AND DATE(DATETIME) = CURDATE()`,
      [userId, problemId]
    );
    if (numTestRuns >= MAX_TEST_RUNS_PER_PROBLEM)
    {
      throw new AppError(`User ${userId} has ${numTestRuns} test runs for question ${problemId}, exceeds max`,
        429,
        'Daily test run limit for this question exceeded.'
      );
    }
  }
  else // Actual submission, not test run
  {
    // Check if user has exceeded max daily programming question submissions
    const [[{ numDailyResponses }]] = await req.db.query(
      `SELECT COUNT(*) as numDailyResponses 
      FROM Response r
      JOIN Question q ON r.PROBLEM_ID = q.ID 
      WHERE r.USERID = ? 
      AND q.TYPE = 'Programming'
      AND DATE(DATETIME) = CURDATE()`,
      [userId]
    );
    if (numDailyResponses >= MAX_SUBMISSIONS_PER_DAY)
    {
      throw new AppError(
        `User ${userId} has ${numDailyResponses} daily submissions, exceeds max`, 
        429, 
        "Daily submission limit exceeded."
      );
    }
  }

  // Get question from database
  const [questions] = await req.db.query(
    `SELECT ID, POINTS_POSSIBLE, CATEGORY, SUBCATEGORY FROM Question WHERE ID = ? AND TYPE = 'Programming'`,
    [problemId]
  );
  if (!questions || questions.length === 0)
  {
    throw new AppError(`No programming question found: ID ${problemId}`, 404, 'Programming question not found.');
  }
  const question = questions[0];

  // Get test cases associated with question
  // If test run, just get the first test case
  const limitClause = isTestRun ? 'LIMIT 1' : '';

  const [testCases] = await req.db.query(
    `SELECT ID, INPUT, EXPECTED_OUTPUT FROM TestCase WHERE QUESTION_ID = ?
    ORDER BY ID ASC ${limitClause}`,
    [problemId]
  );
  if (!testCases || testCases.length === 0)
  {
    throw new AppError(`No test cases found for problem ${problemId}`, 404, 'Test cases not found.');
  }

  // Batch submit to Judge0
  const tokens = await judge0Service.submitBatch(code, languageId, testCases);

  // Poll for results
  const pollResults = await Promise.all(
    tokens.map(token => judge0Service.pollSubmission(token))
  );

  // Check for compilation/runtime errors
  if (hasError(pollResults))
  {
    // Find first error, used for feedback
    const errorResult = pollResults.find(r =>
      r.status.id !== judge0Service.STATUS_IDS.ACCEPTED &&
      r.status.id !== judge0Service.STATUS_IDS.WRONG_ANSWER
    );

    // Note: Saving to database here is intentional.
    // Code with errors still counts toward our API submission limit,
    // so we don't want users burning through it by spam-executing broken code.
    if (isTestRun)
    {
      await req.db.query(
        `INSERT INTO TestRun (USERID, QUESTION_ID) VALUES (?, ?)`,
        [userId, problemId]
      );
    }
    else // Actual submission, not test run
    {
      await req.db.query(
        `INSERT INTO Response (USERID, PROBLEM_ID, USER_ANSWER, ISCORRECT, POINTS_EARNED, POINTS_POSSIBLE, CATEGORY, TOPIC) 
        VALUES (?, ?, ?, FALSE, 0, ?, ?, ?)`,
        [
          userId, 
          problemId, 
          code,
          question.POINTS_POSSIBLE, 
          question.CATEGORY, 
          question.SUBCATEGORY
        ]
      );
    }

    return res.status(200).json({
      success: false,
      isTestRun: isTestRun,
      status: errorResult.status.description,
      error: errorResult.stderr || errorResult.compile_output || 'Execution failed',
      message: 'Your code failed to execute. Please check for errors.'
    });
  }

  // If test run, just save test run to database and return execution output
  if (isTestRun)
  {
    await req.db.query(
      `INSERT INTO TestRun (USERID, QUESTION_ID) VALUES (?, ?)`,
      [userId, problemId]
    );

    const result = pollResults[0];
    
    return res.status(200).json({
      success: true,
      isTestRun: true,
      status: result.status.description,
      stdout: result.stdout?.trim() || null,
      stderr: result.stderr || result.compile_output || null,
      executionTime: result.time,
      memory: result.memory
    });
  }

  // Not a test run, continue with regular grading logic
  // Grade results
  const gradingResults = gradeCodeSubmission(pollResults, testCases, question.POINTS_POSSIBLE);

  // Save submission to database
  await req.db.query(
    `INSERT INTO Response (USERID, PROBLEM_ID, USER_ANSWER, ISCORRECT, POINTS_EARNED, POINTS_POSSIBLE, CATEGORY, TOPIC) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, 
      problemId, 
      code, 
      gradingResults.allPassed, 
      gradingResults.pointsEarned, 
      question.POINTS_POSSIBLE, 
      question.CATEGORY, 
      question.SUBCATEGORY
    ]
  );

  // Return results
  return res.status(200).json({
    success: true,
    isTestRun: false,
    allPassed: gradingResults.allPassed,
    passedTests: gradingResults.passedTests,
    totalTests: gradingResults.totalTests,
    pointsEarned: gradingResults.pointsEarned,
    pointsPossible: question.POINTS_POSSIBLE,
    testResults: gradingResults.testResults
  });
});

module.exports = { submitCode };
