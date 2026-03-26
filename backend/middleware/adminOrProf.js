////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          adminOrProf.js
//  Description:   Express middleware for endpoints accessible
//                 to both professors and admins.
//
//  Dependencies:  adminMiddleware
//                 authMiddleware
//                 requireRole
//
////////////////////////////////////////////////////////////////

const adminMiddleware = require('./adminMiddleware');
const authMiddleware  = require('./authMiddleware');
const requireRole     = require('./requireRole');

/**
 * Middleware chain for endpoints shared between admins and professors.
 * Routes admin requests (with ADMIN_KEY) through adminMiddleware,
 * professor/user requests through authMiddleware + requireRole.
 */
const adminOrProf = [
  (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]?.trim();
    token === process.env.ADMIN_KEY
      ? adminMiddleware(req, res, next)
      : authMiddleware(req, res, next);
  },
  requireRole('admin', 'professor')
];

module.exports = adminOrProf;
