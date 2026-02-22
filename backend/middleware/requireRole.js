////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          requireRole.js
//  Description:   Guard for role-based endpoint
//                 authorization. Must be used AFTER
//                 authMiddleware so that req.user is set.
//
//  Dependencies:  errorHandler
//
////////////////////////////////////////////////////////////////

const { AppError } = require("../middleware/errorHandler");

/**
 * Guard that restricts endpoint access by role.
 * Needs authMiddleware to run first (req.user must be set).
 *
 * @param {...string} allowedRoles - Roles allowed to access the route
 * @returns {import('express').RequestHandler} - Express middleware function
 */
const requireRole = (...allowedRoles) => (req, res, next) => {

  if (!req.user) 
  {
    throw new AppError('Unauthorized: req.user not set', 401, 'Unauthorized.');
  }

  // Role doesn't have access!
  if (!allowedRoles.includes(req.user.role)) 
  {
    throw new AppError(`Forbidden: Insufficient privileges for ${req.user.role} role`, 403, 'Forbidden.');
  }

  next();
};

module.exports = requireRole;
