const express = require("express");
const { runSmokeTest } = require("../services/cosmosStore");

const router = express.Router();

router.post("/cosmos", async (req, res) => {
  try {
    const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : "demo-session";

    const data = await runSmokeTest(sessionId);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      write: false,
      read: false,
      error: error.message
    });
  }
});

module.exports = router;
