const express = require("express");
const { getRecentAnalyses, getAnalysisById } = require("../services/cosmosStore");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const sessionId = typeof req.query?.sessionId === "string" && req.query.sessionId.trim()
      ? req.query.sessionId.trim()
      : "";
    const limit = Number(req.query?.limit || 5);

    const items = await getRecentAnalyses(sessionId, limit);
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

module.exports = router;
