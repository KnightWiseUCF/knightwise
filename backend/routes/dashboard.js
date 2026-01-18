////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          dashboard.js
//  Description:   Protected dashboard route.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

// Protected Dashboard Route
router.get("/", authMiddleware, (req, res) => {
  res.json({ message: "Dashboard Access", user: req.user });
});

module.exports = router;