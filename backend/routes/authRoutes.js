////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          authRoutes.js
//  Description:   Authentication routes for register, login,
//                 email verify, password reset.
//
//  Notes:         Does not use authMiddleware as these
//                 routes are for unauthenticated users.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 jsonwebtoken
//                 node-mailjet
//                 otp-generator
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

// Mailjet for sending verification code
const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
);

const otpGenerator = require("otp-generator");

/**
 * Generates 6-digit numeric one-time password (OTP)
 *
 * @returns {string} A 6-digit numeric verification code
 */
function generateCode() {
  return otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
}

/**
 * @route   POST /api/auth/signup
 * @desc    Registers a new user after email verification.
 * @access  Public
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response confirming user creation
 */
router.post("/signup", asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName } = req.body;
  
  if (!username || !email || !password || !firstName || !lastName) 
  {
    throw new AppError("Missing required fields", 400, "Invalid fields");
  }

  // Search for email verification code
  const [emailRecords] = await req.db.query(
    'SELECT * FROM EmailCode WHERE EMAIL = ?',
    [email]
  );

  if (emailRecords.length === 0 || !emailRecords[0].IS_VERIFIED)
  {
    throw new AppError(`Email not verified: ${email}`, 400, "Email verification is required");
  }

  // Check if user or email already exists
  const [existingUsers] = await req.db.query(
    'SELECT * FROM User WHERE USERNAME = ? OR EMAIL = ?', 
    [username, email]
  );

  if (existingUsers.length > 0)
  {
    throw new AppError(`User "${username}" or email "${email}" already exists`, 400, "User or email already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Insert new user into db
  const [result] = await req.db.query(
    'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashedPassword, firstName, lastName]
  );

  const userId = result.insertId;
  const token = jwt.sign({ userId }, process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  // Signup success, send notification to Discord admin channel
  res.status(201).json({ message: "User Registered", token });
  notifyUserEvent(`New user signed up: ${username} (ID: ${userId})`);
}));

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express request object
 * @returns {Promise<void>} - JSON response with auth token
 */
router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const [users] = await req.db.query(
    'SELECT * FROM User WHERE USERNAME = ?',
    [username]
  );
    
  if (users.length === 0) 
  {
    throw new AppError(`Login failed, user doesn't exist: ${username}`, 400, "User not found");
  }

  // Get user and validate credentials
  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.PASSWORD);

  if (!isMatch)
  {
    throw new AppError(`Login failed, invalid password for user: ${username}`, 400, "Invalid credentials");
  }

  const token = jwt.sign({ userId: user.ID }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.status(200).json({
    message: "User Logged In",
    token,
    user: {
      id: user.ID,
      name: user.USERNAME,
      email: user.EMAIL,
      firstName: user.FIRSTNAME,
      lastName: user.LASTNAME,
    },
  });
}));

/**
 * @route   POST /api/auth/sendotp
 * @desc    Send a one-time password (OTP) to user's email
 *          Email template by @anandu-ap from TailwindFlex
 *          https://tailwindflex.com/@anandu-ap/otp-code-template
 * @access  Public
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response with OTP delivery status
 */
router.post("/sendotp", asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;
  const otp = generateCode();
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  const [users] = await req.db.query(
    'SELECT * FROM User WHERE EMAIL = ?',
    [email]
  );

  // check if the email is already registered to avoid duplicate email
  if (purpose === "signup") 
  {
    if (users.length > 0) 
    {
      throw new AppError(`Signup attempt with existing email: ${email}`, 400, "Email already registered");
    }
  }
  // check if the email is already registered to avoid unregistered users from reset password
  if (purpose === "reset") 
  {
    if (users.length === 0) 
    {
      throw new AppError(`Password reset failed, email not registered: ${email}`, 404, "User not found");
    }
  }

  const [emailRecords] = await req.db.query(
    'SELECT * FROM EmailCode WHERE EMAIL = ?',
    [email]
  );

  // if email exists, update the OTP and expires
  // if email doesn't exist, create EmailCode in MySQL
  if (emailRecords.length > 0) 
  {
    await req.db.query(
      'UPDATE EmailCode SET OTP = ?, EXPIRES = ?, IS_VERIFIED = FALSE WHERE EMAIL = ?',
      [otp, expires, email]
    );
  } 
  else 
  {
    await req.db.query(
      'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, FALSE)',
      [email, otp, expires]
    );
  }

  // send email containing an OTP to user
  try
  {
    const request = await mailjet
      .post('send', { version: 'v3.1' })
      .request(
      {
        Messages: 
        [{
          From: 
          {
            Email: "webdevpeeps@gmail.com",
            Name: "KnightWise"
          },
          To: 
          [{
            Email: email,
            Name: "Studious User"
          }],
          Subject: "Your KnightWise verification code!",
          TextPart: `Your verification code is: ${otp}. This code is valid for 5 minutes. Please do not share this code with anyone. If you didn't request this code, please ignore this email. Thank you for using KnightWise!`,
          HTMLPart: 
          `
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <title>Your KnightWise Verification Code</title>
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <div style="background-color: #ba9b37; padding: 24px; text-align: center;">
                  <h1 style="font-size: 28px; color: white; margin: 0;">Your Verification Code</h1>
                </div>
                <div style="padding: 32px;">
                  <p style="color: #374151; font-size: 16px;">Hello,</p>
                  <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                    Your Verification Code is:
                  </p>
                  <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                    <p style="font-size: 36px; color: black; font-weight: bold; margin: 0;">${otp}</p>
                  </div>
                  <p style="color: #374151; font-size: 16px; margin-bottom: 16px;">
                    This code is valid for <strong>5 minutes</strong>. Please do not share this code with anyone.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">If you didn't request this code, please ignore this email.</p>
                  <p style="color: #6b7280; font-size: 14px;">Thank you for using KnightWise!</p>
                </div>
              </div>
            </body>
            </html>
          `
        }]
      });
      console.log("Email sent successfully:", request.body);
      return res.json({ message: "Code sent successfully" });
  } catch (emailErr)
  {
    throw new AppError(
      `Mailjet error: ${emailErr.statusCode} ${emailErr.message} for email: ${email}`, 
      500, 
      "Failed to send verification code");
  }
}));

/**
 * @route   POST /api/auth/verify
 * @desc    Verify email address using OTP
 * @access  Public
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response confirming verification
 */
router.post("/verify", asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const [records] = await req.db.query(
    'SELECT * FROM EmailCode WHERE EMAIL = ?',
    [email]
  );

  // check the OTP and expiration time related to email
  if (records.length === 0) 
  {
    throw new AppError(`Verify failed, no OTP for email: ${email}`, 400, "No record");
  }

  const record = records[0]
  if (record.OTP !== otp)
  {
    throw new AppError(`Verify failed, incorrect OTP: ${otp}`, 400, "Invalid OTP");
  }
  if (new Date(record.EXPIRES) < new Date())
  {
    throw new AppError(`OTP expired for email: ${email}`, 400, "OTP expired");
  }

  // ensure email verification is marked as complete
  // if other fields (e.g. password, username) are changed when sign in
  await req.db.query(
    'UPDATE EmailCode SET IS_VERIFIED = TRUE WHERE EMAIL = ?',
    [email]
  );
  res.json({ message: "Email verified successfully" });
}));

/**
 * @route   POST /api/auth/resetPassword
 * @desc    Reset user password after email verification
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

  // double check that user email has been verified
  if (records.length === 0 || !records[0].IS_VERIFIED) 
  {
    throw new AppError(`Cannot reset password for "${email}", not verified`, 403, "Email verification required");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // update new password
  await req.db.query(
    'UPDATE User SET PASSWORD = ? WHERE EMAIL = ?',
    [hashedPassword, email]
  );
  res.json({ message: "Password reset" });
}));

module.exports = router;