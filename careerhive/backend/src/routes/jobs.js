const express = require("express");
const router = express.Router();

const MUSE_API_BASE = "https://www.themuse.com/api/public/jobs";

router.get("/", async (req, res) => {
  const apiKey = process.env.MUSE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Job listings unavailable" });
  }

  const page = Math.max(0, parseInt(req.query.page ?? "0", 10) || 0);
  const url = `${MUSE_API_BASE}?api_key=${encodeURIComponent(apiKey)}&page=${page}&descending=true`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Muse API ${response.status}`);

    const data = await response.json();
    const jobs = (data.results ?? []).slice(0, 6).map((j) => ({
      title: j.name,
      location: j.locations?.[0]?.name ?? "Remote",
      url: j.refs?.landing_page ?? null,
    }));

    res.json({ jobs });
  } catch (err) {
    console.error("Muse API error:", err.message);
    res.status(502).json({ error: "Failed to fetch job listings" });
  }
});

module.exports = router;
