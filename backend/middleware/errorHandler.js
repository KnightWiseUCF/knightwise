////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          errorHandler.js
//  Description:   Express middleware that handles errors
//                 and logs using Discord webhook.
//
//  Dependencies:  discordWebhook service (notifyError)
//
////////////////////////////////////////////////////////////////

const { notifyError } = require("../services/discordWebhook");

/**
 * Custom application error class
 * Extends Error with status code and user-facing message
 * Created to avoid having to manually set fields every time an error is thrown
 * 
 * @class AppError
 * @extends Error
 * 
 * @param {string} message - Developer-facing message (sensitive data goes here)
 * @param {number} [statusCode=500] - HTTP status code, defaults to 500
 * @param {string} [userMessage='Internal server error'] - User-facing error message, defaults to server error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, userMessage = 'Internal server error') {
    super(message);
    this.statusCode = statusCode;
    this.userMessage = userMessage;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps async endpoint handlers to automatically catch errors
 * Created to avoid having to constantly use try-catch
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function}  - Express middleware function that catches async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Main error handling middleware
 * Logs errors to Discord webhook and sends appropriate error response to client
 * 
 * @param {Error}                          err  - Error object
 * @param {import('express').Request}      req  - Express request object
 * @param {import('express').Response}     res  - Express response object
 * @param {import('express').NextFunction} next - Next middleware function
 * @returns {void}
 */
function handleError(err, req, res, next)
{
  // Label errors that occur during tests since they are likely intentional
  const isTest = (process.env.NODE_ENV === 'test');

  if (isTest)
  {
    console.log("TEST ERROR:", err);
  }
  else
  {
    console.error("Error:", err);
  }
    
  const statusCode = err.statusCode || 500; // Default to server error

  // Add WWW-Authenticate header if 401 Unauthorized
  if (statusCode === 401)
  {
    res.set("WWW-Authenticate", 'Bearer realm="Access to protected resource"');
  }

  // Change this section to configure which errors are logged
  if (statusCode >= 400)
  {
    const errMsg = `
      **Error Code (${statusCode})**
      **Method:** ${req.method}
      **Path:** ${req.path}
      **Error:** ${err.message}
      **Stack:** \`\`\`${err.stack?.slice(0, 500) || 'No stack trace'}\`\`\`
    `.trim();

    notifyError(errMsg).catch(webhookErr => 
      console.error('Failed to log error with webhook:', webhookErr)
    );
  }

  // If response already sent, don't do it again
  if (!res.headersSent) 
  {
    res.status(statusCode).json({
      message: err.userMessage || 'Internal server error'
    });
  }
}

module.exports = {
  AppError,
  asyncHandler,
  handleError
};