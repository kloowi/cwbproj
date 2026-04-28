const express = require("express");
const { runAnalysis } = require("../services/orchestrator");
const { saveAnalysisRecord } = require("../services/cosmosStore");

const router = express.Router();
const MAX_INPUT_CHARS = 10000;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

let upload;
let extractResumeText;
let extractFeatureError;

let scrapeJobUrl;
let scrapeFeatureError;
try {
  ({ scrapeJobUrl } = require("../services/jobScraper"));
} catch (error) {
  scrapeFeatureError = error;
  console.warn("Job scraping feature disabled:", error.message);
}

try {
  const multer = require("multer");
  ({ extractResumeText } = require("../services/resumeExtractor"));
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES }
  });
} catch (error) {
  extractFeatureError = error;
  console.warn("Resume extraction feature disabled:", error.message);
}

if (upload && extractResumeText) {
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
} else {
  router.post("/extract", (_req, res) => {
    return res.status(503).json({
      error: "Resume upload is temporarily unavailable. Please use pasted resume text for now.",
      detail: extractFeatureError?.message || "Extraction dependencies are unavailable."
    });
  });
}

if (scrapeJobUrl) {
  router.post("/scrape", async (req, res, next) => {
    try {
      const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
      if (!rawUrl) return res.status(400).json({ error: "A URL is required." });
      const { text } = await scrapeJobUrl(rawUrl);
      return res.json({ text });
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "Request to the job URL timed out. Check the URL or paste the description manually." });
      }
      const isUserError = ["Invalid URL", "Failed to fetch", "did not contain", "Only http"].some(m => error.message?.includes(m));
      if (isUserError) return res.status(400).json({ error: error.message });
      return next(error);
    }
  });
} else {
  router.post("/scrape", (_req, res) => {
    return res.status(503).json({ error: "Job URL scraping is temporarily unavailable.", detail: scrapeFeatureError?.message });
  });
}

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

router.post("/enhance-resume", async (req, res, next) => {
  try {
    const resume = typeof req.body?.resume === "string" ? req.body.resume.trim() : "";
    if (!resume) return res.status(400).json({ error: "Resume text is required." });

    const mafUrl = process.env.MAF_SERVICE_URL;
    if (!mafUrl) return res.status(503).json({ error: "Enhancement service is not configured." });

    const { jobTitle = "", jobSkills = [], missing = [], strengths = [], improvements = [], roadmap = [] } = req.body || {};

    const mafRes = await fetch(`${mafUrl}/enhance-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, jobTitle, jobSkills, missing, strengths, improvements, roadmap }),
      signal: AbortSignal.timeout(90_000)
    });

    if (!mafRes.ok) {
      const body = await mafRes.json().catch(() => ({}));
      throw new Error(`Enhancement failed: ${body.detail || mafRes.statusText}`);
    }

    return res.json(await mafRes.json());
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
