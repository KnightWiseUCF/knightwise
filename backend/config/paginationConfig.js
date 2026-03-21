////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          paginationConfig.js
//  Description:   Backend pagination constants
//
////////////////////////////////////////////////////////////////

const PAGE_SIZES = Object.freeze({
  LEADERBOARD:    50, // Max number of users shown on a page of the leaderboard
  USER_SEARCH:    20, // Max number of users shown on a page of the user search componnet
  HISTORY_TABLE:  10, // Max number of responses shown on a page of the History Table
});

module.exports = { PAGE_SIZES };
