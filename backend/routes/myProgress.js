////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          myProgress.js
//  Description:   User progress tracking routes (history
//                 table, topic mastery, daily streak).
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//
////////////////////////////////////////////////////////////////

const express = require('express');
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

// Helper function to process the data and calculate the user's progress
const processProgressData = (answers) => {
  const progress = {};

  answers.forEach((answer) => {
    const topic = answer.TOPIC;
    const isCorrect = answer.ISCORRECT;

    // Initialize topic if not already in progress
    if (!progress[topic]) {
      progress[topic] = { correct: 0, total: 0 };
    }

    // Increment correct/total answers for the topic
    progress[topic].total += 1;
    if (isCorrect) {
      progress[topic].correct += 1;
    }
  });

  // Calculate percentage or other metrics per topic
  for (const topic in progress) {
    const { correct, total } = progress[topic];
    progress[topic].percentage = ((correct / total) * 100).toFixed(2);
  }

  return progress;
};

// GET Progress Data Route
router.get('/graph', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user progress data from the database
    const [userAnswers] = await req.db.query(
      'SELECT * FROM Response WHERE USERID = ?',
      [userId]
    );

    // Process the data to calculate the user's progress (can aggregate by topic/category)
    const progressData = processProgressData(userAnswers);

    res.status(200).json({ progress: progressData });
  } catch (error) {
    console.error("Error fetching progress: ", error);
    res.status(500).json({ message: "Server Error: Unable to fetch progress data" });
  }
});

// GET Progress Data Route
router.get("/messageData", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all answers from the user
    const [userAnswers] = await req.db.query(
      'SELECT * FROM Response WHERE USERID = ?',
      [userId]
    );

    // Process history and mastery levels
    const history = userAnswers.map(({ DATETIME, TOPIC }) => ({
      datetime: DATETIME,
      topic: TOPIC,
    }));

    // Compute mastery levels
    const mastery = {};
    userAnswers.forEach(({ TOPIC, ISCORRECT }) => {
      if (!mastery[TOPIC]) {
        mastery[TOPIC] = { correct: 0, total: 0 };
      }
      mastery[TOPIC].total += 1;
      if (ISCORRECT) {
        mastery[TOPIC].correct += 1;
      }
    });

    // Convert mastery to percentage
    const masteryLevels = {};
    for (const topic in mastery) {
      const { correct, total } = mastery[topic];
      masteryLevels[topic] = Math.round((correct / total) * 100);
    }

    // Calculate streak
    const today = new Date().toDateString();
    console.log("today is ", today);
    const uniqueDays = new Set();
    userAnswers.forEach(({ DATETIME }) => {
      console.log("datetime is ", DATETIME);
      uniqueDays.add(new Date(DATETIME).toDateString());
    });

    // Determine consecutive streak
    let streak = 0;
    const sortedDates = [...uniqueDays]
      .map(dateStr => new Date(dateStr)) // Convert strings to Date objects
      .sort((a, b) => b - a) // Sort by date in descending order (most recent first)
      .map(date => date.toDateString()); // Convert back to strings for the final output

    console.log("sortedDates is ", sortedDates);
    const now = new Date(today);

    for (const dateStr of sortedDates) {
      console.log("dateStr is ", dateStr);
      const entryDate = new Date(dateStr);
      const diff = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
      if (diff === streak) {
        streak++;
        console.log("streak incremented to ", streak);
      } else {
        break;
      }
    }

    console.log("Mastery levels: ", masteryLevels);
    console.log("Streak: ", streak);
    console.log("History: ", history);
    res.status(200).json({ history, mastery: masteryLevels, streak });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ message: "Server Error: Unable to fetch progress data" });
  }
});

// History endpoint with pagination
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("User ID is ", userId);
    
    // Pagination logic: default to page 1, limit to 10 results per page
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;  // Calculate the number of results to skip

    const [history] = await req.db.query(
      'SELECT DATETIME, TOPIC, ISCORRECT, PROBLEM_ID FROM Response WHERE USERID = ? ORDER BY DATETIME DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    // Count the total number of entries for pagination
    const [countResults] = await req.db.query(
      'SELECT COUNT(*) as total FROM Response WHERE USERID = ?',
      [userId]
    );
    const totalEntries = countResults[0].total;
    console.log("totalEntries is ", totalEntries);

    res.status(200).json({
      history: history.map(row => ({
        datetime: row.DATETIME,
        topic: row.TOPIC,
        isCorrect: row.ISCORRECT,
        problem_id: row.PROBLEM_ID
      })),
      totalEntries,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalEntries / limit)),
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;