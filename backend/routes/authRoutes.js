////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          authRoutes.js
//  Description:   Authentication routes for register, login,
//                 email verify, password reset.
//
//  Notes:         Does not use authMiddleware as these
//                 routes are for unauthenticated users.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 bcryptjs
//                 jsonwebtoken
//                 node-mailjet
//                 otp-generator
//                 discordWebhook service (sendNotification)
//
////////////////////////////////////////////////////////////////

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendNotification } = require("../services/discordWebhook");
const router = express.Router();

// Mailjet for sending verification code
const Mailjet = require("node-mailjet");
const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
);

const otpGenerator = require("otp-generator");

// create code using otp-generator library
function generateCode() {
  return otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
}

// Sign Up Route
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "Invalid Fields" });
    }

    // Search for email verification code
    const [emailRecords] = await req.db.query(
      'SELECT * FROM EmailCode WHERE EMAIL = ?',
      [email]
    );

    if (emailRecords.length === 0 || !emailRecords[0].IS_VERIFIED)
    {
      return res
        .status(400)
        .json({ message: "Email verification is required" });
    }

    // Check if user or email already exists
    const [existingUsers] = await req.db.query(
      'SELECT * FROM User WHERE USERNAME = ? OR EMAIL = ?', 
      [username, email]
    );

    if (existingUsers.length > 0)
    {
      return res
        .status(400)
        .json({ message: "User or email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user into db
    const [result] = await req.db.query(
      'INSERT INTO User (USERNAME, EMAIL, PASSWORD, FIRSTNAME, LASTNAME) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, firstName, lastName]
    );

    const userId = result.insertId;
    const token = jwt.sign({ userId }, process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    // Signup success, send notification to Discord admin channel
    res.status(201).json({ message: "User Registered", token });
    sendNotification(`New user signed up: ${username}`)
      .then(success => {
        if (!success) console.warn(`Discord notification not sent for new user "${username}"`);
      })
      .catch(error => console.error("Failed to send new user notification:", error));

  } catch (error) {
    console.error("Signup error: ", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await req.db.query(
      'SELECT * FROM User WHERE USERNAME = ?',
      [username]
    );
      
    if (users.length === 0) return res.status(400).json({ message: "User not found" });
    
    // Get user and validate credentials
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user.ID }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({
      message: "User Logged In",
      token,
      user: {
        id: user.ID,
        name: user.USERNAME,
        email: user.EMAIL,
        firstName: user.FIRSTNAME,
        lastName: user.LASTNAME,
      },
    });
  } catch (error) {
    console.error("Login Error: ", error);
    res.status(500).json({ message: "Server error" });
  }
});

// send OTP via email
// email template by @anandu-ap from TailwindFlex
// https://tailwindflex.com/@anandu-ap/otp-code-template
router.post("/sendotp", async (req, res) => {
  try 
  {
    const { email, purpose } = req.body;
    const otp = generateCode();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const [users] = await req.db.query(
      'SELECT * FROM User WHERE EMAIL = ?',
      [email]
    );

    // check if the email is already registered to avoid duplicate email
    if (purpose === "signup") {
      if (users.length > 0) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }
    // check if the email is already registered to avoid unregistered users from reset password
    if (purpose === "reset") {
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    const [emailRecords] = await req.db.query(
      'SELECT * FROM EmailCode WHERE EMAIL = ?',
      [email]
    );

    // if email exists, update the OTP and expires
    // if email doesn't exist, create EmailCode in MySQL
    if (emailRecords.length > 0) {
      await req.db.query(
        'UPDATE EmailCode SET OTP = ?, EXPIRES = ?, IS_VERIFIED = FALSE WHERE EMAIL = ?',
        [otp, expires, email]
      );
    } else {
      await req.db.query(
        'INSERT INTO EmailCode (EMAIL, OTP, EXPIRES, IS_VERIFIED) VALUES (?, ?, ?, FALSE)',
        [email, otp, expires]
      );
    }

    // send email containing an OTP to user
    try
    {
      const request = await mailjet
        .post('send', { version: 'v3.1' })
        .request(
        {
          Messages: 
          [{
            From: 
            {
              Email: "webdevpeeps@gmail.com",
              Name: "KnightWise"
            },
            To: 
            [{
              Email: email,
              Name: "Studious User"
            }],
            Subject: "Your KnightWise verification code!",
            TextPart: `Your verification code is: ${otp}. This code is valid for 5 minutes. Please do not share this code with anyone. If you didn't request this code, please ignore this email. Thank you for using KnightWise!`,
            HTMLPart: 
            `
              <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <title>Your KnightWise Verification Code</title>
              </head>
              <body style="font-family: Arial, sans-serif; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                  <div style="background-color: #ba9b37; padding: 24px; text-align: center;">
                    <h1 style="font-size: 28px; color: white; margin: 0;">Your Verification Code</h1>
                  </div>
                  <div style="padding: 32px;">
                    <p style="color: #374151; font-size: 16px;">Hello,</p>
                    <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
                      Your Verification Code is:
                    </p>
                    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
                      <p style="font-size: 36px; color: black; font-weight: bold; margin: 0;">${otp}</p>
                    </div>
                    <p style="color: #374151; font-size: 16px; margin-bottom: 16px;">
                      This code is valid for <strong>5 minutes</strong>. Please do not share this code with anyone.
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">If you didn't request this code, please ignore this email.</p>
                    <p style="color: #6b7280; font-size: 14px;">Thank you for using KnightWise!</p>
                  </div>
                </div>
              </body>
              </html>
            `
          }]
        })
        console.log("Email sent successfully:", request.body);
        return res.json({ message: "Code sent successfully" });
    } catch (emailErr)
    {
      console.error("Mailjet Error:", emailErr.statusCode, emailErr.message);
      return res.status(500).json({ message: "Failed to send verification code" });
    }
  } catch (apiErr)
  {
    console.error("Send OTP Error:", apiErr);
    return res.status(500).json({ message: "Server error" });
  }
});

// check verification code
router.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [records] = await req.db.query(
      'SELECT * FROM EmailCode WHERE EMAIL = ?',
      [email]
    );

    // check the OTP and expiration time related to email
    if (records.length === 0) return res.status(400).json({ message: "No Record" });

    const record = records[0]
    if (record.OTP !== otp)
      return res.status(400).json({ message: "Wrong OTP" });
    if (new Date(record.EXPIRES) < new Date())
      return res.status(400).json({ message: "Expired" });

    // ensure email verification is marked as complete
    // if other fields (e.g. password, username) are changed when sign in
    await req.db.query(
      'UPDATE EmailCode SET IS_VERIFIED = TRUE WHERE EMAIL = ?',
      [email]
    );
    res.json({ message: "Verify" });
  } catch (error) {
    console.error("Verify Error: ", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// reset password
router.post("/resetPassword", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [records] = await req.db.query(
      'SELECT * FROM EmailCode WHERE EMAIL = ?',
      [email]
    );

    // double check that user email has been verified
    if (records.length === 0 || !records[0].IS_VERIFIED) {
      return res.status(403).json({ message: "Email verification required" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // update new password
    await req.db.query(
      'UPDATE User SET PASSWORD = ? WHERE EMAIL = ?',
      [hashedPassword, email]
    );
    res.json({ message: "Password reset" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
