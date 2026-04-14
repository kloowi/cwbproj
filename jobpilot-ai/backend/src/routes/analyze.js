const express = require("express");
const multer = require("multer");
const { runAnalysis } = require("../services/orchestrator");
const { saveAnalysisRecord } = require("../services/cosmosStore");
const { extractResumeText } = require("../services/resumeExtractor");

const router = express.Router();
const MAX_INPUT_CHARS = 10000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

router.post("/extract", upload.single("resume"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: "Resume file is required."
      });
    }

    const extracted = await extractResumeText({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname
    });

    if (!extracted.text) {
      return res.status(400).json({
        error: "Unable to extract text from file. Please upload a text-based PDF or DOCX resume."
      });
    }

    if (extracted.text.length > MAX_INPUT_CHARS) {
      return res.status(400).json({
        error: `Extracted resume text must be at most ${MAX_INPUT_CHARS} characters.`
      });
    }

    return res.json({
      text: extracted.text,
      meta: {
        format: extracted.format,
        fileName: file.originalname,
        chars: extracted.text.length
      }
    });
  } catch (error) {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `Resume file must be at most ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`
      });
    }

    return next(error);
  }
});

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
