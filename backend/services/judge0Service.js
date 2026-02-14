////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          judge0Service.js
//  Description:   Service for interacting with Judge0 API
//
//  Dependencies:  errorHandler
//
////////////////////////////////////////////////////////////////

const { AppError } = require("../middleware/errorHandler");

// Fetch and validate API key
const API_KEY = process.env.RAPIDAPI_KEY;
if (!API_KEY)
{
  console.error('ERROR: RAPIDAPI_KEY environment variable not set, code execution will fail');
}

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
const API_HOST = 'judge0-ce.p.rapidapi.com';

// Judge0 programming language IDs
const LANGUAGE_IDS = {
  C:      50, // (GCC 9.2.0)
  CPP:    54, // (GCC 9.2.0)
  JAVA:   62, // (OpenJDK 13.0.1)
  PYTHON: 71  // (3.8.1)
};

// Judge0 execution status IDs
const STATUS_IDS = {
  IN_QUEUE:               1,
  PROCESSING:             2,
  ACCEPTED:               3,
  WRONG_ANSWER:           4,
  TIME_LIMIT_EXCEEDED:    5,
  COMPILATION_ERROR:      6,
  RUNTIME_ERROR_SIGSEGV:  7,
  RUNTIME_ERROR_SIGXFSZ:  8,
  RUNTIME_ERROR_SIGFPE:   9,
  RUNTIME_ERROR_SIGABRT:  10,
  RUNTIME_ERROR_NZEC:     11,
  RUNTIME_ERROR_OTHER:    12,
  INTERNAL_ERROR:         13,
  EXEC_FORMAT_ERROR:      14
};

/**
 * Submit multiple test cases as a batch to Judge0
 * @param {string} sourceCode - User code to execute
 * @param {number} languageId - Judge0 language ID
 * @param {Array}  testCases - Array of {INPUT, EXPECTED_OUTPUT}
 * @returns {Promise<Array<string>>} - Array of submission tokens
 */
const submitBatch = async (sourceCode, languageId, testCases) => {
  if (!API_KEY) 
  {
    throw new AppError('RAPIDAPI_KEY not set', 500, 'Code execution service unavailable.');
  }

  // Create batch submissions
  const submissions = testCases.map(testCase => (
  {
    source_code: sourceCode,
    language_id: languageId,
    stdin: testCase.INPUT || '',
    expected_output: testCase.EXPECTED_OUTPUT
  }));

  const response = await fetch(`${JUDGE0_API_URL}/submissions/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': API_KEY,
      'X-RapidAPI-Host': API_HOST
    },
    body: JSON.stringify({ submissions })
  });

  const data = await response.json();
  
  if (!response.ok) 
  {
    throw new AppError(
      `Judge0 batch submission failed: ${data.message || 'Unknown error'}`,
      502,
      "Code submission failed."
    );
  }
  
  // Extract tokens from response
  return data.map(item => item.token);
};

/**
 * Get submission result from Judge0
 * Helper function for pollSubmission
 * @param {string} token      - Submission token
 * @returns {Promise<Object>} - Submission result
 */
const getSubmission = async (token) => {
  const response = await fetch(
    `${JUDGE0_API_URL}/submissions/${token}`,
    {
      method: 'GET',
      headers: 
      {
        'X-RapidAPI-Key':   API_KEY,
        'X-RapidAPI-Host':  API_HOST
      }
    }
  );

  const data = await response.json();

  if (!response.ok) 
  {
    console.error('Judge0 API error:', {
        status: response.status,
        body: data
    });
    throw new AppError(
      `Failed to get submission results (HTTP ${response.status}): ${data.error || JSON.stringify(data)}`,
      502,
      "Failure to get code results"
    );
  }

  return data;
};

/**
 * Poll for submission result with timeout
 * @param   {string} token        - Submission token
 * @param   {number} maxAttempts  - Maximum polling attempts (default: 10)
 * @param   {number} delayMs      - Delay between attempts in ms (default: 1000)
 * @returns {Promise<Object>}     - Final submission result
 */
const pollSubmission = async (token, maxAttempts = 10, delayMs = 1000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) 
  {
    const result = await getSubmission(token);
    
    // Processing complete if status > PROCESSING
    if (result.status.id > STATUS_IDS.PROCESSING) 
    {    
      return result;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new AppError(
    `Submission polling exceeded maximum attempts: ${maxAttempts}`,
    408,
    'Code execution timed out.');
};

module.exports = {
  submitBatch,
  getSubmission,
  pollSubmission,
  LANGUAGE_IDS,
  STATUS_IDS
};
