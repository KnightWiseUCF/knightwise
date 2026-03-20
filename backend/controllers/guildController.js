////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildController.js
//  Description:   Controller functions for guild operations,
//                 including name generation. 
//                 Requires authentication.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 errorHandler
//                 guildNames
//
////////////////////////////////////////////////////////////////

const { asyncHandler, AppError } = require('../middleware/errorHandler');
const guildNames = require("../config/guildNames");

/**
 * @route   GET /api/guilds/name/generate
 * @desc    Generate a unique guild name in the form "[adjective] [plural noun]"
 *          Guaranteed to generate a name that isn't taken yet by a guild.
 * @access  Protected
 *
 * @param {import('express').Request}  req - Express request object
 * @param {import('express').Response} res - Express response object
 * @throws  {AppError} 500                 - Adjectives or plural nouns list is empty
 * @throws  {AppError} 503                 - All available guild names are in use, we need to add more!
 * @returns {Promise<void>}                - Sends HTTP/JSON response with new guild name
 */
const generateGuildName = asyncHandler(async (req, res) => {
  const { adjectives, pluralNouns } = guildNames;

  // Verify there are names to choose from
  if (!adjectives?.length || !pluralNouns?.length) 
  {
    throw new AppError(`Adjectives or plural nouns list is empty`, 500, 'Guild name word bank is currently unavailable.');
  }

  // Get all the names of every guild (we want to avoid these)
  const [guildRows] = await req.db.query(
    'SELECT NAME FROM Guild'
  );

  // Map rows to a set of taken names
  const takenSet = new Set(guildRows.map(row => row.NAME));

  // Put all available name combinations in an array
  const availableNames = [];
  for (const adj of adjectives)
  {
    for (const noun of pluralNouns)
    {
      const name = `${adj} ${noun}`;
      if (!takenSet.has(name))
      {
        // This combination isn't used, so it's available
        availableNames.push(name);
      }
    }
  }

  if (availableNames.length === 0) 
  {
    throw new AppError('All guild names are taken, add more!', 503, 'All guild names are currently in use, come back later for more!');
  }

  // Return a random name from the list
  const name = availableNames[Math.floor(Math.random() * availableNames.length)];
  return res.status(200).json({ name });
});

module.exports = { generateGuildName };
