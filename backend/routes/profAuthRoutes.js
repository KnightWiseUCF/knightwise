////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          profAuthRoutes.js
//  Description:   Authentication routes for professor
//                 register.
//
//  Notes:         Professor register requires email OTP
//                 verification followed by admin approval.
//
//                 Shares some similar code with authRoutes.js.
//                 If you're changing this file, check to see
//                 if authRoutes.js also needs changing.
//
//                 NOTE THAT PROFESSOR-SPECIFIC ENDPOINTS
//                 DO NOT EXIST for /sendotp and /verify.
//                 These endpoints are generic enough to
//                 not require professor-specific implementation,
//                 so the /sendotp and /verify from authRoutes.js can
//                 be used as is.
//
//                 Does not use authMiddleware as these
//                 routes are for unauthenticated users.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 jsonwebtoken
//                 discordWebhook service (notifyUserEvent)
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { notifyUserEvent } = require("../services/discordWebhook");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const router = express.Router();

/**
 * @route   POST /api/profauth/signup
 * @desc    Registers a new professor after email OTP verification.
 *          Account created with VERIFIED = 0 pending admin approval.
 * 
 *          Has similarities to /auth/signup but uses Professor
 *          table instead, make sure to keep these two endpoints in sync.         
 * 
 * @access  Public
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response confirming professor creation
 */
router.post("/signup", asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName } = req.body;

  if (!username || !email || !password || !firstName || !lastName) {
    throw new AppError("Missing required signup fields", 400, "Invalid fields.");
  }

  // Check if this email was verified by OTP
  const [emailRecords] = await req.db.query(
    'SELECT * FROM EmailCode WHERE EMAIL = ?',
    [email]
  );

  if (emailRecords.length === 0 || !emailRecords[0].IS_VERIFIED) 
  {
    throw new AppError(`Email not verified: ${email}`, 400, "Email verification is required");
  }

  // Check if professor user or email already exists
  const [existingProfs] = await req.db.query(
    'SELECT * FROM User WHERE IS_PROF = 1 AND (USERNAME = ? OR EMAIL = ?)',
    [username, email]
  );

  if (existingProfs.length > 0) {
    throw new AppError(`Professor "${username}" or email "${email}" already exists`, 400, "User or email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert new professor into db
  const [result] = await req.db.query(
    'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, IS_PROF, VERIFIED) VALUES (?, ?, ?, ?, ?, 1, 0)',
    [username, email, hashedPassword, firstName, lastName]
  );

  const profId = result.insertId;

  // Notify Discord, professor registered and needs admin verification
  // Flag emails not ending in .edu
  const eduFlag = email.endsWith('.edu') ? '' : ' (Email not .edu)';
  notifyUserEvent(`New professor registration, pending verification: ${username}, ID ${profId} (${email})${eduFlag}`);

  res.status(201).json({ message: "Professor registered, pending admin verification", profId });
}));

module.exports = router;
