const express = require("express");
const router = express.Router();

const MUSE_API_BASE = "https://www.themuse.com/api/public/jobs";
const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "for", "at", "with", "on", "is", "be", "are"]);
const MAX_JOBS = 3;
const PAGE_MOD = 10;

const museRateLimit = {
  remaining: null,
  limit: null,
  reset: null,
};

router.museRateLimit = museRateLimit;

function roleKeywords(role) {
  return role
    .toLowerCase()
    .split(/[\s,/&()-]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

async function fetchPage(apiKey, page) {
  const url = `${MUSE_API_BASE}?api_key=${encodeURIComponent(apiKey)}&page=${page}&descending=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  
  if (response.headers.has('x-ratelimit-remaining')) {
    museRateLimit.remaining = response.headers.get('x-ratelimit-remaining');
    museRateLimit.limit = response.headers.get('x-ratelimit-limit');
    museRateLimit.reset = response.headers.get('x-ratelimit-reset');
  }

  if (!response.ok) throw new Error(`Muse API ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).map((j) => ({
    title: j.name,
    location: j.locations?.[0]?.name ?? "Remote",
    url: j.refs?.landing_page ?? null,
  }));
}

function strictMatch(jobs, keywords) {
  return jobs.filter((j) =>
    keywords.every((kw) => j.title.toLowerCase().includes(kw))
  );
}

function broadMatch(jobs, keywords) {
  return jobs.filter((j) =>
    keywords.some((kw) => j.title.toLowerCase().includes(kw))
  );
}

router.get("/", async (req, res) => {
  const apiKey = process.env.MUSE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Job listings unavailable" });
  }

  const startPage = Math.max(0, parseInt(req.query.page ?? "0", 10) || 0) % PAGE_MOD;
  const role = String(req.query.role ?? "").trim();

  if (!role) {
    try {
      const results = await fetchPage(apiKey, startPage);
      return res.json({ jobs: results.slice(0, MAX_JOBS) });
    } catch (err) {
      console.error("Muse API error:", err.message);
      return res.status(502).json({ error: "Failed to fetch job listings" });
    }
  }

  const keywords = roleKeywords(role);
  const seen = new Set();
  const accumulated = [];

  function addResults(batch) {
    for (const job of batch) {
      if (job.url) {
        if (!seen.has(job.url)) {
          seen.add(job.url);
          accumulated.push(job);
        }
      } else {
        accumulated.push(job);
      }
    }
  }

  try {
    // Wave 1: 2 pages in parallel
    const wave1 = await Promise.all(
      [0, 1].map((i) => fetchPage(apiKey, (startPage + i) % PAGE_MOD).catch(() => []))
    );
    wave1.forEach(addResults);

    let matched = strictMatch(accumulated, keywords);
    if (matched.length >= MAX_JOBS) return res.json({ jobs: matched.slice(0, MAX_JOBS) });

    matched = broadMatch(accumulated, keywords);
    if (matched.length >= MAX_JOBS) return res.json({ jobs: matched.slice(0, MAX_JOBS) });

    // Wave 2: 3 more pages in parallel
    const wave2 = await Promise.all(
      [2, 3, 4].map((i) => fetchPage(apiKey, (startPage + i) % PAGE_MOD).catch(() => []))
    );
    wave2.forEach(addResults);

    matched = strictMatch(accumulated, keywords);
    if (matched.length >= MAX_JOBS) return res.json({ jobs: matched.slice(0, MAX_JOBS) });

    matched = broadMatch(accumulated, keywords);
    return res.json({ jobs: matched.slice(0, MAX_JOBS) });
  } catch (err) {
    console.error("Muse API error:", err.message);
    return res.status(502).json({ error: "Failed to fetch job listings" });
  }
});

module.exports = router;
