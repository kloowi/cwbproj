const express = require("express");
const { runAnalysis } = require("../services/orchestrator");
const { saveAnalysisRecord } = require("../services/cosmosStore");

const router = express.Router();
const MAX_INPUT_CHARS = 10000;

router.post("/", async (req, res, next) => {
  try {
    const resume = typeof req.body?.resume === "string" ? req.body.resume.trim() : "";
    const job = typeof req.body?.job === "string" ? req.body.job.trim() : "";
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

    const data = await runAnalysis({ resume, job });

    // Persistence should not block response; failures are logged for observability.
    saveAnalysisRecord({ sessionId, resume, job, result: data }).catch((error) => {
      console.warn("Failed to persist analysis record", error.message);
    });

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
