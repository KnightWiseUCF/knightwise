////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          server.js
//  Description:   Main Express app server, backend entry point.
//                 Sets up middleware, database, API routes.
//
//  Dependencies:  express
//                 mysql2/promise
//                 cors
//                 dotenv
//                 route modules
//                 errorHandler
//
////////////////////////////////////////////////////////////////

const express = require('express');
const mysql = require('mysql2/promise')
const cors = require('cors');
const dotenv = require('dotenv');
const { handleError } = require('./middleware/errorHandler');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Fetch and validate db env variables
const db_host       = process.env.DB_HOST;
const db_user       = process.env.DB_USER;
const db_password   = process.env.DB_PASSWORD;
const db_name       = process.env.DB_NAME;

if (!db_host)       console.warn("DB_HOST not set, falling back to localhost");
if (!db_user)       console.error("ERROR: DB_USER not set");
if (!db_password)   console.error("ERROR: DB_PASSWORD not set");
if (!db_name)       console.error("ERROR: DB_NAME not set");

if (!db_user || !db_password || !db_name) process.exit(1);

// Create connection pool
const pool = mysql.createPool(
    {
        host:                   db_host || "localhost",
        user:                   db_user,
        password:               db_password,
        database:               db_name,
        waitForConnections:     true,
        connectionLimit:        5,      
        queueLimit:             10,          
        enableKeepAlive:        true,   
        keepAliveInitialDelay:  0
    }
)

// Connect to MySQL
pool.getConnection()
    .then(connection => {
        console.log("MySQL Connected");
        connection.release();
    })
    .catch(err => {
        console.error("ERROR: MySQL connection error in server.js: ", err);
        console.log("\n\n### REMEMBER TO RUN THE LOCAL PORT FORWARDING COMMAND IN ANOTHER VS CODE TERMINAL! ###")
        console.log('"ssh -L 3306:127.0.0.1:3306 root@104.248.227.132"\n\n')
        process.exit(1);
    });

// Make pool available to API
app.use((req, res, next) => {
    req.db = pool;
    next();
});

app.use((req, res, next) =>
{
    res.setHeader('Access-Control-Allow-origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, DELETE, OPTIONS'
    );
    next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/progress', require('./routes/myProgress'));
app.use('/api/problems', require('./routes/problems'));
app.use('/api/test', require('./routes/test'));
app.use('/api/users', require('./routes/users'));

// Error handler
app.use(handleError);

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// when test 
// module.exports = app; 
