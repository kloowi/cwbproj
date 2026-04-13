import "./styles.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = (configuredApiBaseUrl || (window.location.hostname === "localhost" ? "http://localhost:5050" : "")).replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div>
        <div class="brand-head">
          <div class="brand-chip">JP</div>
          <div>
            <h1 class="brand-title">JobPilot</h1>
            <p class="brand-subtitle">Career Match Navigator</p>
          </div>
        </div>
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
        <div>
          <p class="hero-kicker">Career Command Center</p>
          <h2>Design your next move with clarity.</h2>
          <p>Turn your resume and target role into concrete, score-backed next steps.</p>
        </div>
        <button class="ghost-btn" type="button" id="hero-dashboard-btn">Open Dashboard</button>
      </header>

      <section class="dashboard-view view-hidden" id="dashboard-view" aria-label="Dashboard">
        <section class="dashboard-panel">
          <div class="section-label">Dashboard Overview</div>
          <div class="dashboard-stats" id="dashboard-stats"></div>
        </section>

        <section class="dashboard-panel" aria-label="Application History">
          <div class="history-head">
            <h3>Application History</h3>
            <button class="text-link-btn" type="button" id="view-analysis-btn">Start New Analysis</button>
          </section>
          <div id="dashboard-history"></div>
        </section>
      </section>

      <section class="analysis-view" id="analysis-view">
        <section class="panel" aria-label="Analysis Input">
          <div class="section-label">New Analysis</div>
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

      <section class="dashboard-report-overlay is-hidden" id="dashboard-report-overlay" aria-hidden="true">
        <div class="dashboard-report-dialog card-lite" role="dialog" aria-modal="true" aria-labelledby="saved-report-title">
          <div class="dashboard-report-head">
            <h3 id="saved-report-title">Saved Analysis Report</h3>
            <button type="button" class="ghost-btn" id="close-saved-report-btn">Close</button>
          </div>
          <div id="saved-report-content"></div>
        </div>
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
const heroDashboardBtn = document.querySelector("#hero-dashboard-btn");
const viewAnalysisBtn = document.querySelector("#view-analysis-btn");
const dashboardReportOverlayEl = document.querySelector("#dashboard-report-overlay");
const savedReportContentEl = document.querySelector("#saved-report-content");
const closeSavedReportBtn = document.querySelector("#close-saved-report-btn");

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inferJobTitle(item) {
  const explicit = String(item?.jobTitle || "").trim();
  if (explicit) return explicit;

  const snippet = String(item?.jobSnippet || "").replace(/\s+/g, " ").trim();
  if (!snippet) return "Role Analysis";

  const candidate = snippet.split(/[\n\.|\|:-]/)[0].trim();
  if (!candidate) return "Role Analysis";

  return toTitleCase(candidate.split(/\s+/).slice(0, 7).join(" "));
}

function mapStoredAnalysisToResult(item) {
  return {
    job: {
      title: String(item?.jobTitle || "").trim()
    },
    input: {
      resumeSnippet: String(item?.resumeSnippet || "").trim(),
      jobSnippet: String(item?.jobSnippet || "").trim()
    },
    match: {
      score: Number(item?.matchScore || 0),
      missing: Array.isArray(item?.missingSkills) ? item.missingSkills : [],
      strengths: Array.isArray(item?.strengths) ? item.strengths : [],
      reasoning: String(item?.matchReasoning || "")
    },
    plan: {
      roadmap: Array.isArray(item?.roadmap) ? item.roadmap : []
    },
    meta: {
      provider: item?.provider || "unknown"
    }
  };
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

function hideSavedAnalysisOverlay() {
  dashboardReportOverlayEl.classList.add("is-hidden");
  dashboardReportOverlayEl.setAttribute("aria-hidden", "true");
  savedReportContentEl.innerHTML = "";
}

function showSavedAnalysisOverlay(contentHtml) {
  savedReportContentEl.innerHTML = contentHtml;
  dashboardReportOverlayEl.classList.remove("is-hidden");
  dashboardReportOverlayEl.setAttribute("aria-hidden", "false");
}

function renderSavedAnalysisOverlay(data) {
  const title = escapeHtml(data.job?.title || "Role Analysis");
  const missingList = (data.match?.missing || []).map((item) => `<li>${escapeHtml(toTitleCase(item))}</li>`).join("");
  const strengthsList = (data.match?.strengths || []).map((item) => `<li>${escapeHtml(toTitleCase(item))}</li>`).join("");
  const roadmapList = (data.plan?.roadmap || []).map((item) => `<li>${escapeHtml(toSentenceCase(item))}</li>`).join("");
  const reasoning = escapeHtml(toSentenceCase(data.match?.reasoning || ""));
  const provider = escapeHtml(toTitleCase(data.meta?.provider || "unknown"));
  const score = Math.max(0, Math.min(100, Number(data.match?.score || 0)));
  const resumeSnippet = escapeHtml(data.input?.resumeSnippet || "Resume preview is unavailable for this record.");
  const jobSnippet = escapeHtml(data.input?.jobSnippet || "Job description preview is unavailable for this record.");

  showSavedAnalysisOverlay(`
    <div class="saved-report-kicker">${title}</div>
    <div class="results-grid" aria-live="polite">
      <section class="score-card card-lite">
        <div class="score-ring" style="--score:${score}">
          <span>${score}%</span>
        </div>
        <div class="score-caption">Match Score</div>
        <div class="status-pill">Saved Snapshot</div>
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
        <h3>Saved Input Preview</h3>
        <p class="saved-snippet-label">Resume</p>
        <p class="saved-snippet">${resumeSnippet}</p>
        <p class="saved-snippet-label">Job Description</p>
        <p class="saved-snippet">${jobSnippet}</p>
      </section>
    </div>
  `);
}

function renderDashboard(items) {
  if (!items.length) {
    dashboardStatsEl.innerHTML = `
      <article class="stat-card card-lite">
        <p class="stat-top">Applications</p>
        <p class="stat-label">Total Applications</p>
        <p class="stat-value">0</p>
      </article>
      <article class="stat-card card-lite">
        <p class="stat-top">Average</p>
        <p class="stat-label">Average Match Score</p>
        <p class="stat-value">0%</p>
      </article>
      <article class="stat-card card-lite">
        <p class="stat-top">Best</p>
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
      <p class="stat-top">Applications</p>
      <p class="stat-label">Total Applications</p>
      <p class="stat-value">${totalApplications}</p>
    </article>
    <article class="stat-card card-lite">
      <p class="stat-top">Average</p>
      <p class="stat-label">Average Match Score</p>
      <p class="stat-value">${avgScore}%</p>
    </article>
    <article class="stat-card card-lite">
      <p class="stat-top">Best</p>
      <p class="stat-label">Top Match Score</p>
      <p class="stat-value">${topScore}%</p>
    </article>
  `;

  dashboardHistoryEl.innerHTML = `<div class="history-grid">${items.slice(0, 8).map((item) => {
    const missing = (item.missingSkills || []).map(toTitleCase);
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown";
    const score = Math.max(0, Math.min(100, Number(item.matchScore || 0)));
    const status = score >= 85 ? "Strong Match" : score >= 65 ? "Promising" : "Needs Work";
    const title = inferJobTitle(item);
    const skillsPreview = missing.slice(0, 2).join(" • ") || "No major gaps detected";
    const contextPreview = String(item.jobSnippet || "").replace(/\s+/g, " ").trim();

    return `
      <article class="history-item history-item-clickable card-lite" data-analysis-id="${item.id || ""}" tabindex="0" role="button" aria-label="Open saved report for ${title}">
        <div class="history-item-main">
          <div class="history-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false">
              <path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v4.5a1 1 0 0 1-.62.92L13 16.08a3 3 0 0 1-2 0L4.62 13.42A1 1 0 0 1 4 12.5V8a2 2 0 0 1 2-2h2Zm2 0h4V5h-4v1Zm10 8.2-5.9 2.45a5 5 0 0 1-3.2 0L5 14.2V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.8Z" />
            </svg>
          </div>
          <div>
            <div class="history-title-row">
              <h4>${title}</h4>
              <span class="history-chip">${status}</span>
            </div>
            <p class="history-sub">${date} • ${toTitleCase(item.provider || "unknown")}</p>
            <p class="history-gaps">Skill gaps: ${skillsPreview}</p>
            <p class="history-context">${contextPreview ? `Job preview: ${escapeHtml(contextPreview.slice(0, 90))}` : "Job preview unavailable"}</p>
          </div>
        </div>
        <div class="history-score-wrap">
          <span class="history-score-label">Match Score</span>
          <div class="history-meter" role="presentation">
            <span style="--score:${score}"></span>
          </div>
          <strong>${score}%</strong>
        </div>
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
    const response = await fetch(`${apiBaseUrl}/history?sessionId=${encodeURIComponent(sessionId)}&limit=20`);
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

async function openSavedAnalysis(id) {
  if (!id) return;

  try {
    if (!apiBaseUrl) {
      throw new Error("API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.");
    }

    errorEl.textContent = "";
    setActiveView("dashboard");
    showSavedAnalysisOverlay(`
      <div class="loading-card card-lite">
        <div class="spinner" aria-hidden="true"></div>
        <div>
          <strong>Loading saved report...</strong>
          <p class="subtle">Retrieving analysis details from your history.</p>
        </div>
      </div>
    `);

    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/history/${encodeURIComponent(id)}?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = payload.detail || payload.message || payload.error;
      throw new Error(detail ? `Unable to load saved report: ${detail}` : "Unable to load saved report.");
    }

    const payload = await response.json();
    const data = mapStoredAnalysisToResult(payload.item || {});
    renderSavedAnalysisOverlay(data);
  } catch (error) {
    errorEl.textContent = formatRequestError(error);
    hideSavedAnalysisOverlay();
  }
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
  hideSavedAnalysisOverlay();
  setActiveView("analysis");
  form.reset();
  errorEl.textContent = "";
  renderEmptyResultsState();
  form.resume.focus();
});

navDashboardBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("dashboard");
});

navNewAnalysisBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("analysis");
});

heroDashboardBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("dashboard");
});

viewAnalysisBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("analysis");
  form.resume.focus();
});

closeSavedReportBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
});

dashboardReportOverlayEl.addEventListener("click", (event) => {
  if (event.target === dashboardReportOverlayEl) {
    hideSavedAnalysisOverlay();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dashboardReportOverlayEl.classList.contains("is-hidden")) {
    hideSavedAnalysisOverlay();
  }
});

dashboardHistoryEl.addEventListener("click", (event) => {
  const card = event.target.closest("[data-analysis-id]");
  if (!card) return;

  const id = card.getAttribute("data-analysis-id") || "";
  openSavedAnalysis(id);
});

dashboardHistoryEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest("[data-analysis-id]");
  if (!card) return;

  event.preventDefault();
  const id = card.getAttribute("data-analysis-id") || "";
  openSavedAnalysis(id);
});

renderEmptyResultsState();
setActiveView("analysis");
loadHistory();
