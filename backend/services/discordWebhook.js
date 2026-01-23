////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          discordWebhook.js
//  Description:   Contains functionality for the KnightWise
//                 Discord webhook, used for administration.
//
//  Dependencies:  dotenv 
//                 USER_EVENTS_WEBHOOK (env variable)
//                 ERROR_LOG_WEBHOOK (env variable)
//
////////////////////////////////////////////////////////////////

require('dotenv').config();

const USER_EVENTS_WEBHOOK = process.env.USER_EVENTS_WEBHOOK;
const ERROR_LOG_WEBHOOK = process.env.ERROR_LOG_WEBHOOK;

/**
 * Sends a notification message to the configured Discord webhook.
 *
 * @param   {string}  webhookUrl - URL of webhook to send notification to
 * @param   {string}  content    - Message text sent to Discord
 * @param   {object} [options]   - Optional. General options for future features
 * @returns {Promise<boolean>}   - True if message sent successfully, false otherwise 
 */
async function sendNotification(webhookUrl, content, options = {}) 
{
  if (!webhookUrl) 
  {
    console.error("Error: Failed to get webhook URL");
    return false;
  }

  try 
  {
    const payload = 
    {
      content: content || "<Placeholder message>", // Prevents undefined behavior of no content
      ...options, 
    };

    const response = await fetch(webhookUrl, 
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Failure, non-OK HTTP status
    if (!response.ok) 
    {
      console.error(
        `Error: Discord API returned: ${response.status} ${response.statusText}`
      );
      return false;
    }

    return true; // Message sent successfully
  } 
  // Failure, exception thrown by fetch
  catch (error) 
  {
    console.error("Error: Failure sending Discord webhook:", error);
    return false;
  }
}

/**
 * Helper function, sends notification message to user events webhook.
 *
 * @param   {string}  content  - Message text sent to user events webhook
 * @param   {object} [options] - Optional. General options for future features
 * @returns {Promise<boolean>} - True if message sent successfully, false otherwise 
 */
const notifyUserEvent = (content, options) => sendNotification(USER_EVENTS_WEBHOOK, content, options);

/**
 * Helper function, sends notification message to error log webhook.
 *
 * @param   {string}  content  - Message text sent to error log webhook
 * @param   {object} [options] - Optional. General options for future features
 * @returns {Promise<boolean>} - True if message sent successfully, false otherwise 
 */
const notifyError = (content, options) => sendNotification(ERROR_LOG_WEBHOOK, content, options);

module.exports = { 
  sendNotification,
  notifyUserEvent,
  notifyError
};
