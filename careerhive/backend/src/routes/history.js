const express = require("express");
const { getRecentAnalyses, getAnalysisById, deleteAnalysisById } = require("../services/cosmosStore");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const sessionId = typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
      ? req.query.sessionId.trim()
      : "";
    const limit = typeof req.query?.limit === "string" && req.query.limit.trim()
      ? Number(req.query.limit)
      : null;
    const minScore = typeof req.query?.minScore === "string" && req.query.minScore.trim()
      ? Number(req.query.minScore)
      : null;
    const maxScore = typeof req.query?.maxScore === "string" && req.query.maxScore.trim()
      ? Number(req.query.maxScore)
      : null;
    const dateRange = typeof req.query?.dateRange === "string" && req.query.dateRange.trim()
      ? req.query.dateRange.trim().toLowerCase()
      : "all";

    const items = await getRecentAnalyses(sessionId, limit, {
      minScore,
      maxScore,
      dateRange
    });
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = typeof req.params?.id === "string" ? req.params.id.trim() : "";
    const sessionId = typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
      ? req.query.sessionId.trim()
      : "";

    if (!id) {
      return res.status(400).json({ error: "Analysis id is required." });
    }

    const item = await getAnalysisById(id, sessionId);
    if (!item) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    return res.json({ item });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = typeof req.params?.id === "string" ? req.params.id.trim() : "";
    const sessionId = typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
      ? req.query.sessionId.trim()
      : "";

    if (!id) {
      return res.status(400).json({ error: "Analysis id is required." });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const deleted = await deleteAnalysisById(id, sessionId);
    if (!deleted) {
      return res.status(404).json({ error: "Analysis not found." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
