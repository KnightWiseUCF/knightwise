////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          db.js
//  Description:   MySQL connection pool, shared across app
//
//  Dependencies:  env config
//                 mysql2/promise
//
////////////////////////////////////////////////////////////////

require('./env');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:                  process.env.DB_HOST || 'localhost',
  port:                  Number(process.env.DB_PORT || 3306),
  user:                  process.env.DB_USER,
  password:              process.env.DB_PASSWORD,
  database:              process.env.DB_NAME,
  waitForConnections:    true,
  connectionLimit:       5,
  queueLimit:            10,
  enableKeepAlive:       true,
  keepAliveInitialDelay: 0
});

module.exports = pool;
