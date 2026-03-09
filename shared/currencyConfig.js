////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          currencyConfig.js
//  Description:   Shared config file for defining types, limits, 
//                 and other constants for currency (coins/exp).
//
//  Note:          This file is intentionally .js rather than .ts,
//                 for CommonJS compatibility with our backend Jest. 
//                 To make this .ts, the backend Jest would need to 
//                 be configured with ts-jest or similar.
//
////////////////////////////////////////////////////////////////

// For every point earned, this is how much exp is awarded
const EXP_PER_POINT = 10;

// For every point earned, this is how many coins are awarded
const COINS_PER_POINT = 2;

// Max amount of exp a user can receive in a day
const DAILY_EXP_CAP = 9000;

module.exports = {
  EXP_PER_POINT,
  COINS_PER_POINT,
  DAILY_EXP_CAP,
};