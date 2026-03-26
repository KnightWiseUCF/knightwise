////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          codeSubmission.js
//  Description:   Routes for programming problem
//                 submission and grading using Judge0.
//
//  Dependencies:  express
//                 authMiddleware
//                 codeController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { submitCode, canSubmit } = require("../controllers/codeController");

/**
 * @route   POST /api/code/submitCode
 * @desc    Submit code to Judge0, receive output and grade against test cases.
 * @access  Protected
 */
router.post("/submitCode", authMiddleware, submitCode);

/**
 * @route   GET /api/code/canSubmit
 * @desc    Fetch whether the user still has remaining code submission
 *          attempts for the day, as well as their number of remaining
 *          submissions for the day.
 * @access  Protected
 */
router.get("/canSubmit", authMiddleware, canSubmit);

module.exports = router;
