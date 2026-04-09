////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          validateNameToken.js
//  Description:   Express middleware that verifies a Guild name
//                 token created by GET /api/guilds/name/generate.
//                 Attaches the verified Guild name to req.guildName.
//
//  Dependencies:  jsonwebtoken
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

if (!process.env.JWT_SECRET)
{
  throw new Error('JWT_SECRET environment variable not configured');
}

/**
 * Middleware to validate a Guild name reservation token
 *
 * Expects req.body.nameToken to be a JWT signed by the server
 * via GET /api/guilds/name/generate. 
 * 
 * Verifies token, confirms it's for the requesting user, attaches reserved
 * name to req.guildName before calling next().
 *
 * @param {import('express').Request}      req  - Express request object
 * @param {import('express').Response}     res  - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 *
 * @returns {void} Calls next() or throws AppError
 */
const validateNameToken = (req, res, next) => {
  const { nameToken } = req.body;

  if (!nameToken)
  {
    throw new AppError('Missing Guild name token', 400, 'A valid name token is required to create a Guild.');
  }

  try
  {
    const decoded = jwt.verify(nameToken, process.env.JWT_SECRET);

    if (decoded.userId !== req.user.id)
    {
      throw new AppError('Name token user mismatch', 400, 'Invalid name token.');
    }

    if (decoded.guildName !== req.body.name)
    {
      throw new AppError('Name token guildName mismatch', 400, 'Invalid name token.');
    }

    // Verification successful, pass on the Guild name
    req.guildName = decoded.guildName;
    next();
  }
  catch (err)
  {
    if (err instanceof AppError) throw err;

    const message = err.name === 'TokenExpiredError'
      ? 'Your Guild name choice expired, please shuffle and try again.'
      : 'Invalid name token.';

    throw new AppError(`Name token verification failed: ${err.message}`, 400, message);
  }
};

module.exports = validateNameToken;
