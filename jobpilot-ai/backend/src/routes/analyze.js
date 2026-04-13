const express = require("express");
const { runAnalysis } = require("../services/orchestrator");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const resume = typeof req.body?.resume === "string" ? req.body.resume.trim() : "";
    const job = typeof req.body?.job === "string" ? req.body.job.trim() : "";

    if (!resume || !job) {
      return res.status(400).json({
        error: "Both resume and job fields are required."
      });
    }

    const data = await runAnalysis({ resume, job });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
