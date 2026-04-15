const express = require("express");
const { runInterviewPrep } = require("../services/orchestrator");
const { saveInterviewRecord } = require("../services/cosmosStore");

const router = express.Router();
const MAX_INPUT_CHARS = 10000;

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function synthesizeInterviewInputsFromAnalysis(context) {
  const title = String(context.jobTitle || "").trim();
  const snippet = String(context.jobSnippet || "").trim();
  const missingSkills = normalizeStringArray(context.missingSkills);
  const strengths = normalizeStringArray(context.strengths);
  const roadmap = normalizeStringArray(context.roadmap);
  const reasoning = String(context.matchReasoning || "").trim();

  const resume = [
    strengths.length ? `Demonstrated strengths: ${strengths.join(", ")}.` : "",
    roadmap.length ? `Improvement plan in progress: ${roadmap.join(" ")}` : "",
    reasoning ? `Assessment summary: ${reasoning}` : ""
  ].filter(Boolean).join("\n");

  const job = [
    title ? `Target role: ${title}.` : "",
    snippet ? `Job summary: ${snippet}` : "",
    missingSkills.length ? `Priority gaps to prepare for: ${missingSkills.join(", ")}.` : ""
  ].filter(Boolean).join("\n");

  return {
    resume,
    job
  };
}

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
      analysisId: "",
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

router.post("/from-analysis", async (req, res, next) => {
  try {
    const analysisId = typeof req.body?.analysisId === "string" ? req.body.analysisId.trim() : "";
    const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : "demo-session";
    const difficulty = typeof req.body?.difficulty === "string" && req.body.difficulty.trim()
      ? req.body.difficulty.trim()
      : "Intermediate";

    const validDifficulties = ["Basic", "Intermediate", "Advanced"];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: `Difficulty must be one of: ${validDifficulties.join(", ")}.`
      });
    }

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const synthesized = synthesizeInterviewInputsFromAnalysis(payload);

    if (!synthesized.resume || !synthesized.job) {
      return res.status(400).json({
        error: "Analysis context is incomplete. Provide job and match-summary fields from a saved analysis."
      });
    }

    if (synthesized.resume.length > MAX_INPUT_CHARS || synthesized.job.length > MAX_INPUT_CHARS) {
      return res.status(400).json({
        error: `Derived interview context exceeded ${MAX_INPUT_CHARS} characters.`
      });
    }

    const data = await runInterviewPrep({
      resume: synthesized.resume,
      job: synthesized.job,
      difficulty
    });

    data.meta = {
      ...(data.meta || {}),
      source: "analysis-context",
      analysisId
    };

    saveInterviewRecord({
      sessionId,
      analysisId,
      resume: synthesized.resume,
      job: synthesized.job,
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
