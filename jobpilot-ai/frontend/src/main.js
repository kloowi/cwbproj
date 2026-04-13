import "./styles.css";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050").replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="container">
    <h1>JobPilot AI</h1>
    <p>Paste your resume and target job description to get a quick score, skill gaps, and roadmap.</p>

    <section class="card">
      <form id="analyze-form">
        <label for="resume">Resume</label>
        <textarea id="resume" name="resume" placeholder="Paste resume text"></textarea>

        <label for="job">Job Description</label>
        <textarea id="job" name="job" placeholder="Paste job description"></textarea>

        <button id="submit-btn" type="submit">Analyze</button>
      </form>
      <div id="error" class="error"></div>
      <div id="results"></div>
    </section>

    <section class="card">
      <h2>Recent Analyses</h2>
      <div id="history"></div>
    </section>
  </main>
`;

const form = document.querySelector("#analyze-form");
const submitBtn = document.querySelector("#submit-btn");
const errorEl = document.querySelector("#error");
const resultsEl = document.querySelector("#results");
const historyEl = document.querySelector("#history");

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const created = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

function renderHistory(items) {
  if (!items.length) {
    historyEl.innerHTML = "<p>No saved analyses yet.</p>";
    return;
  }

  historyEl.innerHTML = items.map((item) => {
    const missing = (item.missingSkills || []).join(", ") || "none";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "unknown";
    return `
      <article class="card">
        <div><strong>Score:</strong> ${item.matchScore ?? 0}%</div>
        <div><strong>Missing:</strong> ${missing}</div>
        <div class="meta">${date} • ${item.provider || "unknown"}</div>
      </article>
    `;
  }).join("");
}

async function loadHistory() {
  try {
    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/history?sessionId=${encodeURIComponent(sessionId)}&limit=5`);
    if (!response.ok) throw new Error("History fetch failed");
    const payload = await response.json();
    renderHistory(Array.isArray(payload.items) ? payload.items : []);
  } catch (_error) {
    historyEl.innerHTML = "<p>Could not load history yet.</p>";
  }
}

function renderResults(data) {
  const missingList = (data.match?.missing || []).map((item) => `<li>${item}</li>`).join("");
  const strengthsList = (data.match?.strengths || []).map((item) => `<li>${item}</li>`).join("");
  const roadmapList = (data.plan?.roadmap || []).map((item) => `<li>${item}</li>`).join("");

  resultsEl.innerHTML = `
    <div class="card">
      <div class="score">${data.match?.score ?? 0}%</div>
      <div>Match score</div>
      <div class="meta">Provider: ${data.meta?.provider || "unknown"}</div>
      <p>${data.match?.reasoning || ""}</p>
    </div>

    <div class="grid">
      <div class="card">
        <strong>Missing skills</strong>
        <ul>${missingList || "<li>None detected</li>"}</ul>
      </div>

      <div class="card">
        <strong>Strengths</strong>
        <ul>${strengthsList || "<li>None detected</li>"}</ul>
      </div>

      <div class="card">
        <strong>Roadmap</strong>
        <ul>${roadmapList || "<li>No roadmap generated</li>"}</ul>
      </div>
    </div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  resultsEl.innerHTML = "";

  const resume = form.resume.value.trim();
  const job = form.job.value.trim();

  if (!resume || !job) {
    errorEl.textContent = "Please fill both resume and job description.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Analyzing...";

  try {
    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, job, sessionId })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Request failed");
    }

    const data = await response.json();
    renderResults(data);
    await loadHistory();
  } catch (error) {
    errorEl.textContent = error.message || "Unexpected error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyze";
  }
});

loadHistory();
