////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          store.js
//  Description:   Express routes for store operations.
//                 Protected by JWT authentication.
//
//  Dependencies:  express
//                 authMiddleware
//                 storeController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { getStoreItems, purchaseItem } = require("../controllers/storeController");

/**
 * @route   GET /api/store
 * @desc    Fetch data for all store items
 * @access  Protected
 */
router.get("/", authMiddleware, getStoreItems);

/**
 * @route   POST /api/store/:id/purchase
 * @desc    Attempt to purchase a store item with coins
 * @access  Protected
 */
router.post("/:id/purchase", authMiddleware, purchaseItem);

module.exports = router;
