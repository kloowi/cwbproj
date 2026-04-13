const express = require("express");
const { getRecentAnalyses } = require("../services/cosmosStore");

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

module.exports = router;
