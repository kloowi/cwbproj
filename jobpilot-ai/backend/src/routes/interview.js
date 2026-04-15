const express = require("express");
const { runInterviewPrep } = require("../services/orchestrator");
const { saveInterviewRecord } = require("../services/cosmosStore");

const router = express.Router();
const MAX_INPUT_CHARS = 10000;

router.post("/", async (req, res, next) => {
  try {
    const resume = typeof req.body?.resume === "string" ? req.body.resume.trim() : "";
    const job = typeof req.body?.job === "string" ? req.body.job.trim() : "";
    const difficulty = typeof req.body?.difficulty === "string" && req.body.difficulty.trim()
      ? req.body.difficulty.trim()
      : "Intermediate";
    const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : "demo-session";

    if (!resume || !job) {
      return res.status(400).json({
        error: "Both resume and job fields are required."
      });
    }

    if (resume.length > MAX_INPUT_CHARS || job.length > MAX_INPUT_CHARS) {
      return res.status(400).json({
        error: `Resume and job must be at most ${MAX_INPUT_CHARS} characters each.`
      });
    }

    const validDifficulties = ["Basic", "Intermediate", "Advanced"];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: `Difficulty must be one of: ${validDifficulties.join(", ")}.`
      });
    }

    const data = await runInterviewPrep({ resume, job, difficulty });

    // Save to database async (non-blocking)
    saveInterviewRecord({
      sessionId,
      resume,
      job,
      difficulty,
      data
    }).catch((err) => {
      console.error("Failed to save interview record:", err.message);
    });

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
