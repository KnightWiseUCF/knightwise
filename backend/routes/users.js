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
      } = require("../controllers/userController");

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

module.exports = router;
