////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025
//  Author(s):     Daniel Landsman
//  File:          codeController.js
//  Description:   Controller functions for routes/codeSubmission.js.
//
//  Dependencies:  judge0Service
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const judge0Service = require('../services/judge0Service');
const { asyncHandler, AppError } = require('../middleware/errorHandler');


const MAX_CODE_LENGTH = 10000; // 10KB limit per code submit

/**
 * @route   POST /api/codeSubmission/submitCode
 * @desc    Submit code to Judge0, receive output and grade against test cases.
 * @access  Protected
 * 
 * @param   {import('express').Request}  req - Express request object
 * @param   {import('express').Response} res - Express response object
 * @returns {Promise<void>}                  - Sends HTTP/JSON response
 */
const submitCode = asyncHandler(async (req, res) => {
  // Code can only be submitted by account owner
  const userId = req.user.id; // Set by authMiddleware.js
  const { problemId, code, languageId } = req.body;

  if (!problemId || !code || !languageId || code.trim().length === 0)
  {
    throw new AppError('Empty problemId, code, or languageId', 400, 'Missing required fields');
  }

  // Limit code size/resource usage
  // Currently 10KB, may need to be adjusted
  if (code.length > MAX_CODE_LENGTH) 
  {
    throw new AppError(
      `Code submission too long, exceeds ${MAX_CODE_LENGTH} bytes`,
      400,
      'Code submission too long'
    );
  }

  // TODO: Track and prevent exceeding submission count, less than 50 per day

  // TODO: Get problem from database to get expectedOutput
  const stdin = "Hello World";
  const expectedOutput = "Hello World"; // Hardcoded for test

  // Submit to Judge0
  const token = await judge0Service.submitCode(code, languageId, stdin);

  // Poll for results
  const result = await judge0Service.pollSubmission(token);

  // Check for execution success
  if (result.status.id !== judge0Service.STATUS_IDS.ACCEPTED)
  {
    // Failed
    return res.status(200).json({
      success: false,
      status: result.status.description,
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: result.compile_output
    });
  }

  // Grade against expected output
  const isCorrect = (result.stdout?.trim() === expectedOutput.trim());

  // TODO: Save submission to database

  return res.status(200).json({
    success: true,
    correct: isCorrect,
    stdout: result.stdout,
    expectedOutput: expectedOutput,
    executionTime: result.time,
    memory: result.memory
  });
});

module.exports = { submitCode };
