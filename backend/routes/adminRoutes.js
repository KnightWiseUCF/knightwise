////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Mina G.
//  File:          adminRoutes.js
//  Description:   Admin routes for TODO
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 otp-generator
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const adminMiddleware = require("../middleware/adminMiddleware");

/**
 * @route   DELETE /api/admin/user/:id
 * @desc    Delete a user's account and associated data
 * @access  Admin
 */
router.delete("/users/:id", adminMiddleware, asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Ensure userId is a valid primary key
  if (isNaN(parseInt(userId)) || parseInt(userId) <= 0)
  {
    throw new AppError(`Failed to delete user, userId not a valid primary key: ${userId}`, 400, "Invalid user ID");
  }

  // Get user info
  const [users] = await req.db.query(
    'SELECT * FROM User WHERE ID = ?',
    [userId]
  );

  if (users.length === 0)
  { 
    throw new AppError(`Failed to delete user, userId not found: ${userId}`, 404, "User not found");
  }

  const user = users[0];

  // Delete user and associated email code/answers
  await req.db.query('DELETE FROM User WHERE ID = ?', [userId]);
  await req.db.query('DELETE FROM EmailCode WHERE EMAIL = ?', [user.EMAIL]);
  await req.db.query('DELETE FROM Response WHERE USERID = ?', [userId]);
  console.log(`User ${userId} and all associated data deleted successfully`);

  return res
    .status(200)
    .json({ message: "Account deleted successfully" });
}));

/**
 * @route   POST /api/admin/createuser
 * @desc    Allows an admin to create an accout bypassing verification
 * @access  Admin
 * 
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} - JSON response to confirm successful submission
 */
router.post("/createuser", adminMiddleware, asyncHandler(async(req, res) => {
  const { username, email, password, firstName, lastName } = req.body;
  
  if (!username || !email || !password || !firstName || !lastName) 
  {
    throw new AppError("Missing required fields", 400, "Invalid fields");
  }
  
  // Check if user already exists
  const [existingUsers] = await req.db.query(
    'SELECT * FROM User WHERE USERNAME = ?', 
    [username]
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

  res.status(201).json({ message: "User Registered", userId});

}));
module.exports = router;