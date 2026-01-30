////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          env.js
//  Description:   Setup file used in jest.config.cjs
//                 to ensure env path is set before
//                 anything is read
//
//  Dependencies:  path
//                 dotenv
//
////////////////////////////////////////////////////////////////

const path = require('path');

// Use test env file if testing
const envFile = (process.env.NODE_ENV === 'test' ? '.env.test' : '.env');

require('dotenv').config(
{
  path: path.resolve(process.cwd(), envFile),
});

console.log('Loaded environment file:', envFile);
