////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guilds.js
//  Description:   Express routes for guild operations.
//                 Protected by JWT authentication.
//
//  Dependencies:  express
//                 authMiddleware
//                 guildController
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { generateGuildName } = require("../controllers/guildController");

/**
 * @route   GET /api/guilds/name/generate
 * @desc    Generate a unique guild name in the form "[adjective] [plural noun]"
 *          Guaranteed to generate a name that isn't taken yet by a guild.
 * @access  Protected
 */
router.get("/name/generate", authMiddleware, generateGuildName);

module.exports = router;
