////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          codeSubmission.js
//  Description:   Routes for programming problem
//                 submission and grading using Judge0.
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { submitCode } = require("../controllers/codeController");

/**
 * @route   POST /api/codeSubmission/submitCode
 * @desc    Submit code to Judge0, receive output and grade against test cases.
 * @access  Protected
 */
router.post("/submitCode", authMiddleware, submitCode);

module.exports = router;
