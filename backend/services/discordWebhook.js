////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025
//  Author(s):     Daniel Landsman
//  File:          discordWebhook.js
//  Description:   Contains functionality for the KnightWise
//                 Discord webhook, used for administration.
//
////////////////////////////////////////////////////////////////

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Sends a notification message to the configured Discord webhook.
 *
 * @param   {string}  content  - Message text sent to Discord
 * @param   {object} [options] - Optional. General options for future features
 * @returns {boolean}          - True if message sent successfully, false otherwise 
 */
async function sendNotification(content, options = {}) 
{
  if (!DISCORD_WEBHOOK_URL) 
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

    const response = await fetch(DISCORD_WEBHOOK_URL, 
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

module.exports = { sendNotification };