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

const express    = require('express');
const router     = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
  generateGuildName,
  createGuild,
  leaveGuild,
  deleteGuild,
  getGuildInfo,
  contributeCoins,
  kickMember,
  updateMemberRole,
  equipGuildItem,
  unequipGuildItem,
  inviteUser,
  requestToJoin,
  resolveEntry,
  getGuildRequests,
  updateGuildOpen
} = require('../controllers/guildController');

/**
 * @route   GET /api/guilds/name/generate
 * @desc    Generate a unique guild name in the form "[adjective] [plural noun]"
 *          Guaranteed to generate a name that isn't taken yet by a guild.
 * @access  Protected
 */
router.get('/name/generate', authMiddleware, generateGuildName);

/**
 * @route   POST /api/guilds
 * @desc    Create a new guild
 * @access  Protected
 */
router.post('/', authMiddleware, createGuild);

//////////////////////////////////////////////////////////////////////////////////////
//
//   ##### ALL NON-WILDCARD ROUTES MUST GO BEFORE THESE WILDCARD (/:id) ROUTES #####
//
//////////////////////////////////////////////////////////////////////////////////////

/**
 * @route   GET /api/guilds/:id
 * @desc    Get guild info and equipped items
 * @access  Protected
 */
router.get('/:id', authMiddleware, getGuildInfo);

/**
 * @route   DELETE /api/guilds/:id/leave
 * @desc    Leave a guild (Member or Officer only)
 * @access  Protected
 */
router.delete('/:id/leave', authMiddleware, leaveGuild);

/**
 * @route   DELETE /api/guilds/:id
 * @desc    Delete a guild (Owner only)
 * @access  Protected
 */
router.delete('/:id', authMiddleware, deleteGuild);

/**
 * @route   POST /api/guilds/:id/contribute
 * @desc    Contribute coins to guild bank
 * @access  Protected
 */
router.post('/:id/contribute', authMiddleware, contributeCoins);

/**
 * @route   DELETE /api/guilds/:id/members/:userId
 * @desc    Kick a member from the guild
 * @access  Protected
 */
router.delete('/:id/members/:userId', authMiddleware, kickMember);

/**
 * @route   PATCH /api/guilds/:id/members/:userId/role
 * @desc    Promote or demote a guild member
 * @access  Protected
 */
router.patch('/:id/members/:userId/role', authMiddleware, updateMemberRole);

/**
 * @route   PUT /api/guilds/:id/equip
 * @desc    Equip an unlocked guild item
 * @access  Protected
 */
router.put('/:id/equip', authMiddleware, equipGuildItem);

/**
 * @route   PUT /api/guilds/:id/unequip
 * @desc    Unequip an equipped guild item
 * @access  Protected
 */
router.put('/:id/unequip', authMiddleware, unequipGuildItem);

/**
 * @route   POST /api/guilds/:id/invite
 * @desc    Invite a user to the guild
 * @access  Protected
 */
router.post('/:id/invite', authMiddleware, inviteUser);

/**
 * @route   POST /api/guilds/:id/request
 * @desc    Request to join a guild
 * @access  Protected
 */
router.post('/:id/request', authMiddleware, requestToJoin);

/**
 * @route   PATCH /api/guilds/:id/entry/:userId
 * @desc    Accept or reject a guild entry
 * @access  Protected
 */
router.patch('/:id/entry/:userId', authMiddleware, resolveEntry);

/**
 * @route   GET /api/guilds/:id/requests
 * @desc    Get pending join requests for a guild
 * @access  Protected
 */
router.get('/:id/requests', authMiddleware, getGuildRequests);

/**
 * @route   PATCH /api/guilds/:id/open
 * @desc    Toggle guild open/closed status for join requests
 * @access  Protected — Officer or Owner only
 */
router.patch('/:id/open', authMiddleware, updateGuildOpen);

module.exports = router;
