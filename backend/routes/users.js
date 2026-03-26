////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          users.js
//  Description:   Express routes for user operations.
//                 Protected by JWT authentication.
//
//  Dependencies:  express
//                 authMiddleware
//                 userController
//                 guildController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { 
        deleteAccount, 
        getUserInfo, 
        updateUser,
        getPurchases,
        equipItem,
        unequipItem,
        followUser,
        unfollowUser,
        searchUsers,
        updateStatsOptIn,
      } = require("../controllers/userController");
const { getMyInvites } = require('../controllers/guildController');

/**
 * @route   GET /api/users/search
 * @desc    Search users by username (partial, case-insensitive), paginated
 *          Call with username and page as query parameters
 * @access  Protected
 */
router.get("/search", authMiddleware, searchUsers);

/**
 * @route   GET /api/users/me/guild-invites
 * @desc    Search users by username (partial, case-insensitive), paginated
 *          Call with username and page as query parameters
 * @access  Protected
 */
router.get('/me/guild-invites', authMiddleware, getMyInvites);

//////////////////////////////////////////////////////////////////////////////////////
//
//   ##### ALL NON-WILDCARD ROUTES MUST GO BEFORE THESE WILDCARD (/:id) ROUTES #####
//
//////////////////////////////////////////////////////////////////////////////////////

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user's account and associated data
 * @access  Protected
 */
router.delete("/:id", authMiddleware, deleteAccount);

/**
 * @route   GET /api/users/:id
 * @desc    Fetch a user's profile info
 * @access  Protected
 */
router.get("/:id", authMiddleware, getUserInfo);

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user's profile (first name, last name)
 * @access  Protected
 */
router.put("/:id", authMiddleware, updateUser);

/**
 * @route   GET /api/users/:id/purchases
 * @desc    Fetch a user's purchased store items
 * @access  Protected
 */
router.get("/:id/purchases", authMiddleware, getPurchases);

/**
 * @route   PUT /api/users/:id/equip
 * @desc    Equip a purchased store item
 * @access  Protected
 */
router.put("/:id/equip", authMiddleware, equipItem);

/**
 * @route   PUT /api/users/:id/unequip
 * @desc    Unequip a purchased store item
 * @access  Protected
 */
router.put("/:id/unequip", authMiddleware, unequipItem);

/**
 * @route   POST /api/users/:id/follow
 * @desc    Follow the user with the given ID
 * @access  Protected
 */
router.post("/:id/follow", authMiddleware, followUser);

/**
 * @route   DELETE /api/users/:id/follow
 * @desc    Unfollow the user with the given ID
 * @access  Protected
 */
router.delete("/:id/follow", authMiddleware, unfollowUser);

/**
 * @route   PUT /api/users/:id/stats-opt-in
 * @desc    Toggle IS_SHARING_STATS for the user
 * @access  Protected
 */
router.put("/:id/stats-opt-in", authMiddleware, updateStatsOptIn);

module.exports = router;
