////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          profAuthRoutes.js
//  Description:   Authentication routes for professor
//                 register, login, email verify, password reset.
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
    'SELECT * FROM Professor WHERE USERNAME = ? OR EMAIL = ?',
    [username, email]
  );

  if (existingProfs.length > 0) {
    throw new AppError(`Professor "${username}" or email "${email}" already exists`, 400, "User or email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert new professor into db
  const [result] = await req.db.query(
    'INSERT INTO Professor (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME, VERIFIED) VALUES (?, ?, ?, ?, ?, 0)',
    [username, email, hashedPassword, firstName, lastName]
  );

  const profId = result.insertId;

  // Notify Discord, professor registered and needs admin verification
  // Flag emails not ending in .edu
  const eduFlag = email.endsWith('.edu') ? '' : ' (Email not .edu)';
  notifyUserEvent(`New professor registration, pending verification: ${username}, ID ${profId} (${email})${eduFlag}`);

  res.status(201).json({ message: "Professor registered, pending admin verification", profId });
}));

/**
 * @route   POST /api/profauth/login
 * @desc    Authenticate verified professor and return JWT with role
 * 
 *          Has similarities to /auth/login but uses Professor
 *          table instead, make sure to keep these two endpoints in sync.  
 * 
 * @access  Public
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express request object
 * @returns {Promise<void>} - JSON response with auth token
 */
router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const [profs] = await req.db.query(
    'SELECT * FROM Professor WHERE USERNAME = ?',
    [username]
  );

  if (!profs || profs.length === 0) 
  {
    throw new AppError(`Login failed, professor doesn't exist: ${username}`, 400, "User not found");
  }

  // Get professor and validate credentials
  const prof = profs[0];
  const isMatch = await bcrypt.compare(password, prof.PASSWORD);

  if (!isMatch) 
  {
    throw new AppError(`Login failed, invalid password for professor: ${username}`, 400, "Invalid credentials.");
  }

  // Unverified professors can't login until admin approves
  if (!prof.VERIFIED) 
  {
    throw new AppError(`Login failed, professor not yet verified: ${username}`, 403, "Account pending verification.");
  }

  // Attach professor role to JWT
  const token = jwt.sign(
    { userId: prof.ID, role: 'professor', verified: true },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.status(200).json({
    message: "Professor Logged In",
    token,
    user: {
      id: prof.ID,
      name: prof.USERNAME,
      email: prof.EMAIL,
      firstName: prof.FIRSTNAME,
      lastName: prof.LASTNAME,
    },
  });
}));

/**
 * @route   POST /api/profauth/resetPassword
 * @desc    Reset professor password after email verification
 * 
 *          Has similarities to /auth/resetPassword but uses Professor
 *          table instead, make sure to keep these two endpoints in sync.
 * 
 * @access  Public
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response confirming password reset
 */
router.post("/resetPassword", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [records] = await req.db.query(
    'SELECT * FROM EmailCode WHERE EMAIL = ?',
    [email]
  );

  // Confirm that professor email is verified
  if (records.length === 0 || !records[0].IS_VERIFIED) 
  {
    throw new AppError(`Cannot reset password for "${email}", not verified`, 403, "Email verification required.");
  }

  // Get professor's current password hash
  const [profs] = await req.db.query(
    'SELECT PASSWORD FROM Professor WHERE EMAIL = ?',
    [email]
  );
  if (profs.length === 0) 
  {
    throw new AppError(`Professor not found for email: ${email}`, 404, "User not found.");
  }

  // Ensure new password is different from the old one
  const isSamePassword = await bcrypt.compare(password, profs[0].PASSWORD);
  if (isSamePassword) 
  {
    throw new AppError(`Cannot reset password for "${email}", same as current password`, 400, "Your new password cannot be the same as your current password.");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Update new password
  await req.db.query(
    'UPDATE Professor SET PASSWORD = ? WHERE EMAIL = ?',
    [hashedPassword, email]
  );
  res.json({ message: "Password reset" });
}));

module.exports = router;
