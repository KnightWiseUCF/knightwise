////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025
//  Author(s):     Daniel Landsman
//  File:          users.js
//  Description:   Express routes for user operations.
//                 Protected by JWT authentication.
//
//  Dependencies:  express
//                 authMiddleware
//                 userController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
// TODO: Add getUserInfo and updateUser when implemented
const { deleteAccount } = require("../controllers/userController");

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user's account and associated data
 * @access  Protected
 */
router.delete("/:id", authMiddleware, deleteAccount);

/** TODO
 * @route   GET /api/users/:id
 * @desc    Fetch a user's profile
 * @access  Protected
 */
// router.get("/:id", authMiddleware, getUserInfo);

/** TODO
 * @route   PUT /api/users/:id
 * @desc    Update a user's profile (profile picture)
 * @access  Protected
 */
// router.put("/:id", authMiddleware, updateUser);

module.exports = router;
