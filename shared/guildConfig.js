////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildConfig.js
//  Description:   Shared config for guild constants.
//
//  Note:          This file is intentionally .js rather than .ts,
//                 for CommonJS compatibility with our backend Jest.
//                 To make this .ts, the backend Jest would need to 
//                 be configured with ts-jest or similar.
//
////////////////////////////////////////////////////////////////

// Maximum number of members a guild can have (including owner)
const MAX_GUILD_SIZE = 20;

// Ratio of exp earned by a member that is also contributed to their guild's exp banks
// Does not decrement from the member's own exp, just adds to the guild
// Example: 0.1 means 10% of earned exp is also added to the guild
const GUILD_EXP_CONTRIBUTION_RATIO = 0.1;

module.exports = {
  MAX_GUILD_SIZE,
  GUILD_EXP_CONTRIBUTION_RATIO,
};
