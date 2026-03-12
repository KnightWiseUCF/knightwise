////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          expReset.js
//  Description:   Cron scheduler for resetting user exp
//
//  Dependencies:  node-cron
//                 mysql2 connection pool (server.js)
//
////////////////////////////////////////////////////////////////

const cron = require('node-cron');
const pool = require('../config/db');

const startExpResetJobs = () =>
{
  // Every day at midnight UTC
  cron.schedule('0 0 * * *', async () => {
  await pool.query('UPDATE User SET DAILY_EXP = 0');
  console.log('Daily EXP reset');
  });

  // Every Monday at midnight UTC
  cron.schedule('0 0 * * 1', async () => {
  await pool.query('UPDATE User SET WEEKLY_EXP = 0');
  console.log('Weekly EXP reset');
  });
};

module.exports = { startExpResetJobs };
