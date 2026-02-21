////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Mina G.
//  File:          adminMiddleware.js
//  Description:   Express middleware that checks for an admin
//                 key to protect routes.
//
//  Dependencies:  errorHandler
//
////////////////////////////////////////////////////////////////

const { AppError } = require("../middleware/errorHandler");

// Ensure ADMIN_KEY env variable set
if (!process.env.ADMIN_KEY)
{
    throw new Error("ADMIN_KEY environment variable not configured");
}

/**
 * Middleware to protect Express routes by checking for a secret key.
 *
 * If key is valid, attaches admin role to req.user and calls next().
 * If missing/invalid, responds with 401 Unauthorized.
 *
 * @param {import('express').Request}      req  - Express request object
 * @param {import('express').Response}     res  - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 *
 * @returns {void} Sends 401 response or calls next()
 */
const adminMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 401 Unauthorized if improper token, case insensitive
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer "))
  {
    throw new AppError("Unauthorized access attempt: Improper token", 401, "Unauthorized");
  }

  const token = authHeader.split(" ")[1].trim();

  // Validate token is present
  if (!token)
  {
    throw new AppError("Unauthorized access attempt: Missing token", 401, "Unauthorized");
  }

  // Compare to admin key, 401 Unauthorized doesn't match
  // Attach admin role to authorize for endpoints shared with professors
  if (token === process.env.ADMIN_KEY)
  {
    req.user = { role: 'admin' };
    next();
  }
  else
  {
    throw new AppError("Unauthorized access attempt: Improper token", 401, "Unauthorized");
  }
}

module.exports = adminMiddleware;