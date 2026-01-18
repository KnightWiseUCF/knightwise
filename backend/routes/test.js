////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          test.js
//  Description:   Routes for mock test generation, topic
//                 practice, and answer submission.
//
//  Dependencies:  mysql2 connection pool (req.db)
//                 express
//                 authMiddleware
//
////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Helper function, gets answers for given questions, pairs them with each question
 * @param {Array} questions - Array of question objects with ID field
 * @param {Object} db - Database connection pool
 * @returns {Promise<Array>} Questions with paired answers array
 */
const pairAnswersWithQuestions = async (questions, db) => {
  if (!questions || questions.length === 0) {
    return questions;
  }

  const questionIds = questions.map(q => q.ID);
  const [answers] = await db.query(
    'SELECT * FROM AnswerText WHERE QUESTION_ID IN (?)',
    [questionIds]
  );

  return questions.map(question => ({
    ...question,
    answers: answers.filter(answer => answer.QUESTION_ID === question.ID)
  }));
};

// topic test
router.get("/topic/:topicName", async (req, res) => {
  const { topicName } = req.params;

  try {
    // Get all questions of this subcategory
    const [questions] = await req.db.query(
      'SELECT * FROM Question WHERE SUBCATEGORY = ?',
      [topicName]
    );

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: "Question not found" });
    }

    const questionsWithAnswers = await pairAnswersWithQuestions(questions, req.db);
    res.json(questionsWithAnswers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/mocktest", async (req, res) => {
  try {
    const sections = ["A", "B", "C", "D"];
    const questionsBySection = {};

    // shuffled problem per section and pick three question randomly
    for (const section of sections) {
      const [questions] = await req.db.query(
        'SELECT * FROM Question WHERE SECTION = ?',
        [section]
      );

      if (!questions || questions.length === 0) {
        return res
          .status(404)
          .json({ message: `Question not found in section ${section}` });
      }
      const shuffled = questions.sort(() => 0.5 - Math.random());
      questionsBySection[section] = shuffled.slice(0, 3);
    }

    const allQuestions = Object.values(questionsBySection).flat();
    const questionsWithAnswers = await pairAnswersWithQuestions(allQuestions, req.db);

    res.status(200).json({ total: questionsWithAnswers.length, questions: questionsWithAnswers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Note: 'SUBCATEGORY' from Question table is stored as 'TOPIC' in Response table
router.post("/submit", authMiddleware, async (req, res) => {
  try {
    const { problem_id, isCorrect, category, topic } = req.body;
    const user_id = req.user.id;

    await req.db.query(
      'INSERT INTO Response (USERID, PROBLEM_ID, ISCORRECT, CATEGORY, TOPIC, DATETIME) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, problem_id, isCorrect, category, topic, new Date()]
    );

    res.status(201).json({ message: "Answer submitted" });
  } catch (error) {
    console.error("Submit Answer Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;