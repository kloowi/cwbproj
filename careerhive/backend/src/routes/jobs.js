const express = require("express");
const router = express.Router();

const MUSE_API_BASE = "https://www.themuse.com/api/public/jobs";
const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "for", "at", "with", "on", "is", "be", "are"]);

function roleKeywords(role) {
  return role
    .toLowerCase()
    .split(/[\s,/&()-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

router.get("/", async (req, res) => {
  const apiKey = process.env.MUSE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Job listings unavailable" });
  }

  const page = Math.max(0, parseInt(req.query.page ?? "0", 10) || 0);
  const role = String(req.query.role ?? "").trim();
  const url = `${MUSE_API_BASE}?api_key=${encodeURIComponent(apiKey)}&page=${page}&descending=true`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Muse API ${response.status}`);

    const data = await response.json();
    const allResults = data.results ?? [];

    const mapped = allResults.map((j) => ({
      title: j.name,
      location: j.locations?.[0]?.name ?? "Remote",
      url: j.refs?.landing_page ?? null,
    }));

    if (role) {
      const keywords = roleKeywords(role);
      const matched = mapped.filter((j) =>
        keywords.some((kw) => j.title.toLowerCase().includes(kw))
      );
      // Fill up to 3 with non-matching results if needed
      const filler = mapped.filter((j) =>
        !keywords.some((kw) => j.title.toLowerCase().includes(kw))
      );
      const jobs = [...matched, ...filler].slice(0, 3);
      return res.json({ jobs });
    }

    res.json({ jobs: mapped.slice(0, 3) });
  } catch (err) {
    console.error("Muse API error:", err.message);
    res.status(502).json({ error: "Failed to fetch job listings" });
  }
});

module.exports = router;
