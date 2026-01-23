////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          authMiddleware.js
//  Description:   Express middleware that verifies JWT tokens
//                 to protect routes. Attaches the authenticated
//                 user payload to req.user.
//
//  Dependencies:  jsonwebtoken
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const jwt = require("jsonwebtoken");
const { AppError } = require("../middleware/errorHandler");


// Ensure JWT_SECRET environment variable set
if (!process.env.JWT_SECRET) 
{
  throw new Error("JWT_SECRET environment variable not configured");
}

/**
 * Middleware to protect Express routes by verifying JWT.
 *
 * If token valid, attaches decoded payload to `req.user`.
 * If missing/invalid, responds with 401 Unauthorized.
 *
 * @param {import('express').Request}      req  - Express request object
 * @param {import('express').Response}     res  - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 *
 * @returns {void} Sends 401 response or calls next()
 */
const authMiddleware = (req, res, next) => {
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

  // Try to verify, 401 Unauthorized if error
  try 
  {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, ...decoded }; // Attach decoded payload
    next(); // Proceed to route handler
  } 
  catch (err) 
  {
    // Check if token expired or other error
    const errStr = (err.name === "TokenExpiredError") 
      ? "Unauthorized access attempt: Expired token" 
      : `JWT verification failed: ${err.message}`;
    throw new AppError(errStr, 401, "Unauthorized");
  }
};

module.exports = authMiddleware;