const cheerio = require("cheerio");
const MAX_JOB_TEXT_CHARS = 10_000;

async function scrapeJobUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error("Invalid URL format."); }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response;
  try {
    response = await fetch(rawUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Failed to fetch URL (HTTP ${response.status}).`);

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, noscript").remove();
  const text = ($("main").length ? $("main") : $("body")).text()
    .replace(/\s{2,}/g, " ").trim();

  if (!text) throw new Error("The page at that URL did not contain extractable text. Try pasting the description manually.");

  return { text: text.slice(0, MAX_JOB_TEXT_CHARS) };
}

module.exports = { scrapeJobUrl };
