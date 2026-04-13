import "./styles.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = (configuredApiBaseUrl || (window.location.hostname === "localhost" ? "http://localhost:5050" : "")).replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div>
        <h1 class="brand-title">JobPilot AI</h1>
        <p class="brand-subtitle">Career Match Navigator</p>
      </div>
      <nav class="nav-group" aria-label="Primary Navigation">
        <button class="nav-item" type="button" id="nav-dashboard">Dashboard</button>
        <button class="nav-item nav-active" type="button" id="nav-new-analysis">New Analysis</button>
        <button class="nav-item" type="button" disabled>Job Matches</button>
        <button class="nav-item" type="button" disabled>Skill Insights</button>
      </nav>
      <div class="sidebar-footer">
        <button class="new-analysis-btn" type="button" id="new-analysis-btn">+ New Analysis</button>
      </div>
    </aside>

    <main class="workspace">
      <header class="hero">
        <h2>Let's Land Your Next Job</h2>
        <p>Upload your details and let AI bridge the gap to your target role.</p>
      </header>

      <section class="dashboard-view view-hidden" id="dashboard-view" aria-label="Dashboard">
        <section class="dashboard-panel">
          <div class="section-label">Dashboard Overview</div>
          <div class="dashboard-stats" id="dashboard-stats"></div>
        </section>

        <section class="dashboard-panel" aria-label="Application History">
          <div class="history-head">
            <h3>Application History</h3>
            <p>Tracked from your recent analysis history.</p>
          </section>
          <div id="dashboard-history"></div>
        </section>
      </section>

      <section class="analysis-view" id="analysis-view">
        <section class="panel" aria-label="Analysis Input">
          <form id="analyze-form" class="input-grid">
            <section class="input-card">
              <label for="resume">Resume</label>
              <textarea id="resume" name="resume" placeholder="Paste your resume or profile summary"></textarea>
            </section>

            <section class="input-card">
              <label for="job">Job Description</label>
              <textarea id="job" name="job" placeholder="Paste the job description you are targeting"></textarea>
            </section>

            <div class="form-actions">
              <button id="submit-btn" type="submit" class="primary-btn">Start AI Analysis</button>
            </div>
          </form>
          <div id="error" class="error"></div>
        </section>

        <section class="results-panel" aria-label="Analysis Results">
          <div class="section-label">Analysis Results</div>
          <div id="results"></div>
        </section>
      </section>
    </main>
  </div>
`;

const form = document.querySelector("#analyze-form");
const submitBtn = document.querySelector("#submit-btn");
const errorEl = document.querySelector("#error");
const resultsEl = document.querySelector("#results");
const dashboardStatsEl = document.querySelector("#dashboard-stats");
const dashboardHistoryEl = document.querySelector("#dashboard-history");
const dashboardViewEl = document.querySelector("#dashboard-view");
const analysisViewEl = document.querySelector("#analysis-view");
const navDashboardBtn = document.querySelector("#nav-dashboard");
const navNewAnalysisBtn = document.querySelector("#nav-new-analysis");
const newAnalysisBtn = document.querySelector("#new-analysis-btn");

function setActiveView(view) {
  const showDashboard = view === "dashboard";
  dashboardViewEl.classList.toggle("view-hidden", !showDashboard);
  analysisViewEl.classList.toggle("view-hidden", showDashboard);
  navDashboardBtn.classList.toggle("nav-active", showDashboard);
  navNewAnalysisBtn.classList.toggle("nav-active", !showDashboard);
}

function formatRequestError(error) {
  const message = String(error?.message || "").toLowerCase();
  const isNetworkFailure = message.includes("networkerror") || message.includes("failed to fetch") || message.includes("load failed");

  if (!apiBaseUrl) {
    return "API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.";
  }

  if (isNetworkFailure) {
    return `Unable to reach backend API at ${apiBaseUrl}. Verify backend health, CORS, and frontend VITE_API_URL setting.`;
  }

  return error?.message || "An unexpected error occurred.";
}

function toTitleCase(text) {
  if (!text) return "";
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toSentenceCase(text) {
  if (!text) return "";
  const normalized = text.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const created = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

function renderDashboard(items) {
  if (!items.length) {
    dashboardStatsEl.innerHTML = `
      <article class="stat-card card-lite">
        <p class="stat-label">Total Applications</p>
        <p class="stat-value">0</p>
      </article>
      <article class="stat-card card-lite">
        <p class="stat-label">Average Match Score</p>
        <p class="stat-value">0%</p>
      </article>
      <article class="stat-card card-lite">
        <p class="stat-label">Top Match Score</p>
        <p class="stat-value">0%</p>
      </article>
    `;
    dashboardHistoryEl.innerHTML = "<p class=\"empty\">No saved analyses are available yet.</p>";
    return;
  }

  const scoreValues = items.map((item) => Number(item.matchScore || 0)).filter((value) => Number.isFinite(value));
  const totalApplications = items.length;
  const avgScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) : 0;
  const topScore = scoreValues.length ? Math.max(...scoreValues) : 0;

  dashboardStatsEl.innerHTML = `
    <article class="stat-card card-lite">
      <p class="stat-label">Total Applications</p>
      <p class="stat-value">${totalApplications}</p>
    </article>
    <article class="stat-card card-lite">
      <p class="stat-label">Average Match Score</p>
      <p class="stat-value">${avgScore}%</p>
    </article>
    <article class="stat-card card-lite">
      <p class="stat-label">Top Match Score</p>
      <p class="stat-value">${topScore}%</p>
    </article>
  `;

  dashboardHistoryEl.innerHTML = `<div class="history-grid">${items.slice(0, 8).map((item) => {
    const missing = (item.missingSkills || []).map(toTitleCase).join(", ") || "None";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown";
    return `
      <article class="history-item card-lite">
        <div class="history-row"><strong>Match Score</strong><span>${item.matchScore ?? 0}%</span></div>
        <div class="history-row"><strong>Missing Skills</strong><span>${missing}</span></div>
        <div class="meta">${date} • ${toTitleCase(item.provider || "unknown")}</div>
      </article>
    `;
  }).join("")}</div>`;
}

async function loadHistory() {
  try {
    if (!apiBaseUrl) {
      dashboardStatsEl.innerHTML = "<p class=\"empty\">Dashboard is unavailable until VITE_API_URL is configured.</p>";
      dashboardHistoryEl.innerHTML = "<p class=\"empty\">History is unavailable until VITE_API_URL is configured.</p>";
      return;
    }

    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/history?sessionId=${encodeURIComponent(sessionId)}&limit=50`);
    if (!response.ok) throw new Error("History fetch failed");
    const payload = await response.json();
    renderDashboard(Array.isArray(payload.items) ? payload.items : []);
  } catch (_error) {
    dashboardStatsEl.innerHTML = "<p class=\"empty\">Dashboard is temporarily unavailable.</p>";
    dashboardHistoryEl.innerHTML = "<p class=\"empty\">History is temporarily unavailable.</p>";
  }
}

function renderLoadingState() {
  resultsEl.innerHTML = `
    <div class="loading-card card-lite">
      <div class="spinner" aria-hidden="true"></div>
      <div>
        <strong>Analyzing your profile...</strong>
        <p class="subtle">Please wait while we evaluate match quality and recommendations.</p>
      </div>
    </div>
  `;
}

function renderEmptyResultsState() {
  resultsEl.innerHTML = `
    <section class="card-lite empty-state">
      <strong>Submit Your First Analysis</strong>
      <p>Results will appear here after you provide both a resume and a target job description.</p>
    </section>
  `;
}

function renderResults(data) {
  const missingList = (data.match?.missing || []).map((item) => `<li>${toTitleCase(item)}</li>`).join("");
  const strengthsList = (data.match?.strengths || []).map((item) => `<li>${toTitleCase(item)}</li>`).join("");
  const roadmapList = (data.plan?.roadmap || []).map((item) => `<li>${toSentenceCase(item)}</li>`).join("");
  const reasoning = toSentenceCase(data.match?.reasoning || "");
  const provider = toTitleCase(data.meta?.provider || "unknown");
  const score = Math.max(0, Math.min(100, Number(data.match?.score || 0)));

  resultsEl.innerHTML = `
    <div class="results-grid" aria-live="polite">
      <section class="score-card card-lite">
        <div class="score-ring" style="--score:${score}">
          <span>${score}%</span>
        </div>
        <div class="score-caption">Match Score</div>
        <div class="status-pill">Conservative Estimate</div>
        <p class="score-text">${reasoning || "A concise reasoning summary is not available for this run."}</p>
        <div class="meta">Provider: ${provider}</div>
      </section>

      <section class="insight-card card-lite">
        <div class="insight-head">
          <h3>Priority Skill Gaps</h3>
          <span class="tag attention">Needs Attention</span>
        </div>
        <ul class="pill-list">${missingList || "<li>None</li>"}</ul>
        <div class="quick-note">
          <strong>Recommended Next Steps</strong>
          <ul>${roadmapList || "<li>No roadmap was generated.</li>"}</ul>
        </div>
      </section>
    </div>

    <div class="results-grid secondary">
      <section class="card-lite">
        <h3>Strengths</h3>
        <ul>${strengthsList || "<li>None detected</li>"}</ul>
      </section>
      <section class="card-lite">
        <h3>Score Breakdown</h3>
        <ul>
          <li>Matched Strengths: ${(data.match?.strengths || []).length}</li>
          <li>Missing Skills: ${(data.match?.missing || []).length}</li>
          <li>Recommended Actions: ${(data.plan?.roadmap || []).length}</li>
        </ul>
      </section>
    </div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  resultsEl.innerHTML = "";

  const resume = form.resume.value.trim();
  const job = form.job.value.trim();

  if (!apiBaseUrl) {
    errorEl.textContent = "API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.";
    return;
  }

  if (!resume || !job) {
    errorEl.textContent = "Please complete both the Resume and Job Description fields.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Analyzing...";
  renderLoadingState();

  try {
    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume, job, sessionId })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = payload.detail || payload.message || payload.error;
      throw new Error(detail ? `Request failed (${response.status}): ${detail}` : `Request failed with status ${response.status}.`);
    }

    const data = await response.json();
    renderResults(data);
    await loadHistory();
  } catch (error) {
    errorEl.textContent = formatRequestError(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Start AI Analysis";
  }
});

newAnalysisBtn.addEventListener("click", () => {
  setActiveView("analysis");
  form.reset();
  errorEl.textContent = "";
  renderEmptyResultsState();
  form.resume.focus();
});

navDashboardBtn.addEventListener("click", () => {
  setActiveView("dashboard");
});

navNewAnalysisBtn.addEventListener("click", () => {
  setActiveView("analysis");
});

renderEmptyResultsState();
setActiveView("analysis");
loadHistory();
