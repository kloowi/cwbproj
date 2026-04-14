import "./styles.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = (configuredApiBaseUrl || (window.location.hostname === "localhost" ? "http://localhost:5050" : "")).replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";
const ACTIVE_VIEW_KEY = "jobpilot_active_view";
const PIPELINE_STAGE_DURATION_MS = 1100;
const PIPELINE_REVEAL_DELAY_MS = 280;

const PIPELINE_STAGES = [
  {
    id: "resume_extract",
    label: "Resume Agent",
    detail: "Extracting skills and experience"
  },
  {
    id: "job_extract",
    label: "Job Agent",
    detail: "Parsing role requirements"
  },
  {
    id: "skill_match",
    label: "Match Agent",
    detail: "Comparing profile against role"
  },
  {
    id: "roadmap_plan",
    label: "Plan Agent",
    detail: "Building targeted roadmap"
  }
];

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
    </aside>

    <main class="workspace">
      <header class="hero">
        <div>
          <p class="hero-kicker">Career Command Center</p>
          <h2>Design your next move with clarity.</h2>
          <p>Turn your resume and target role into concrete, score-backed next steps.</p>
        </div>
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
          </div>
          <div class="history-filters" aria-label="History Filters">
            <label class="filter-field">
              <span>Min Score</span>
              <input type="number" id="filter-min-score" min="0" max="100" value="0" placeholder="0" />
            </label>
            <label class="filter-field">
              <span>Max Score</span>
              <input type="number" id="filter-max-score" min="0" max="100" value="100" placeholder="100" />
            </label>
            <label class="filter-field">
              <span>Date</span>
              <select id="filter-date-range">
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <button type="button" class="text-link-btn" id="reset-history-filters">Reset</button>
          </div>
          <div id="dashboard-history"></div>
        </section>
      </section>

      <section class="analysis-view" id="analysis-view">
        <section class="panel" aria-label="Analysis Input">
          <div class="section-label">New Analysis</div>
          <form id="analyze-form" class="input-grid">
            <section class="input-card">
              <label for="resume-file">Resume Upload</label>
              <input id="resume-file" name="resumeFile" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
              <p class="upload-note">Upload a PDF or DOCX resume file.</p>
              <p class="file-status" id="resume-file-status">No file selected.</p>
              <div class="privacy-notice" aria-label="Privacy Notice">
                <p class="privacy-title">Privacy Notice</p>
                <ul class="privacy-list">
                  <li><span class="privacy-label">Stored data:</span> A short resume preview (first 250 characters), a short job preview (first 250 characters), match score, skill gaps, roadmap, and provider.</li>
                  <li><span class="privacy-label">Retention:</span> Analysis history is kept for 30 days.</li>
                  <li><span class="privacy-label">Delete:</span> Go to Dashboard &gt; Application History, then use the delete icon on a card.</li>
                </ul>
              </div>
            </section>

            <section class="input-card">
              <label for="job">Job Description</label>
              <textarea id="job" name="job" placeholder="Paste the job description you are targeting"></textarea>
            </section>

            <div class="form-actions">
              <label class="consent-row" for="consent-checkbox">
                <input id="consent-checkbox" name="consent" type="checkbox" />
                <span>I consent to processing my resume and job description for AI analysis and history display.</span>
              </label>
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
const viewAnalysisBtn = document.querySelector("#view-analysis-btn");
const filterMinScoreEl = document.querySelector("#filter-min-score");
const filterMaxScoreEl = document.querySelector("#filter-max-score");
const filterDateRangeEl = document.querySelector("#filter-date-range");
const resetHistoryFiltersBtn = document.querySelector("#reset-history-filters");
const dashboardReportOverlayEl = document.querySelector("#dashboard-report-overlay");
const savedReportContentEl = document.querySelector("#saved-report-content");
const closeSavedReportBtn = document.querySelector("#close-saved-report-btn");
const resumeFileEl = document.querySelector("#resume-file");
const resumeFileStatusEl = document.querySelector("#resume-file-status");
const consentCheckboxEl = document.querySelector("#consent-checkbox");

let openSavedAnalysisId = "";
let filterDebounceTimer = null;
let pipelineState = null;
let pipelineRunToken = 0;
let pipelineTimers = [];

function setActiveView(view) {
  const normalizedView = view === "dashboard" ? "dashboard" : "analysis";
  const showDashboard = normalizedView === "dashboard";
  dashboardViewEl.classList.toggle("view-hidden", !showDashboard);
  analysisViewEl.classList.toggle("view-hidden", showDashboard);
  navDashboardBtn.classList.toggle("nav-active", showDashboard);
  navNewAnalysisBtn.classList.toggle("nav-active", !showDashboard);

  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, normalizedView);
  } catch (_error) {
  }
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

function getInitialView() {
  try {
    const stored = localStorage.getItem(ACTIVE_VIEW_KEY);
    if (stored === "dashboard" || stored === "analysis") {
      return stored;
    }
  } catch (_error) {
  }

  return "analysis";
}

function hideSavedAnalysisOverlay() {
  dashboardReportOverlayEl.classList.add("is-hidden");
  dashboardReportOverlayEl.setAttribute("aria-hidden", "true");
  savedReportContentEl.innerHTML = "";
  openSavedAnalysisId = "";
}

function showSavedAnalysisOverlay(contentHtml) {
  savedReportContentEl.innerHTML = contentHtml;
  dashboardReportOverlayEl.classList.remove("is-hidden");
  dashboardReportOverlayEl.setAttribute("aria-hidden", "false");
}

function parseScoreInput(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function getHistoryFilters() {
  const minScore = parseScoreInput(filterMinScoreEl.value);
  const maxScore = parseScoreInput(filterMaxScoreEl.value);

  return {
    minScore,
    maxScore: minScore !== null && maxScore !== null && maxScore < minScore ? minScore : maxScore,
    dateRange: String(filterDateRangeEl.value || "all")
  };
}

function hasActiveHistoryFilters() {
  const filters = getHistoryFilters();
  return filters.minScore !== null || filters.maxScore !== null || filters.dateRange !== "all";
}

function buildHistoryQuery(sessionId) {
  const filters = getHistoryFilters();
  const query = new URLSearchParams({
    sessionId,
    limit: "20"
  });

  if (filters.minScore !== null) query.set("minScore", String(filters.minScore));
  if (filters.maxScore !== null) query.set("maxScore", String(filters.maxScore));
  if (filters.dateRange !== "all") query.set("dateRange", filters.dateRange);

  return query.toString();
}

function scheduleHistoryReload() {
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
  }

  filterDebounceTimer = setTimeout(() => {
    loadHistory();
  }, 220);
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
    dashboardHistoryEl.innerHTML = hasActiveHistoryFilters()
      ? "<p class=\"empty\">No analyses match the current filters.</p>"
      : "<p class=\"empty\">No saved analyses are available yet.</p>";
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
          <button type="button" class="delete-analysis-btn" data-action="delete-analysis" data-analysis-id="${item.id || ""}" aria-label="Delete ${escapeHtml(title)}">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" />
            </svg>
          </button>
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
    const response = await fetch(`${apiBaseUrl}/history?${buildHistoryQuery(sessionId)}`);
    if (!response.ok) throw new Error("History fetch failed");
    const payload = await response.json();
    renderDashboard(Array.isArray(payload.items) ? payload.items : []);
  } catch (_error) {
    dashboardStatsEl.innerHTML = "<p class=\"empty\">Dashboard is temporarily unavailable.</p>";
    dashboardHistoryEl.innerHTML = "<p class=\"empty\">History is temporarily unavailable.</p>";
  }
}

function renderLoadingState(title = "Analyzing your profile...", subtitle = "Please wait while we evaluate match quality and recommendations.") {

  const pipelineHtml = pipelineState ? `
    <div class="pipeline-shell" aria-live="polite" aria-label="Agent pipeline progress">
      <div class="pipeline-head">
        <strong>Agent Pipeline</strong>
        <span>${escapeHtml(pipelineState.progressLabel || "Starting...")}</span>
      </div>
      <div class="pipeline-track">
        ${pipelineState.stages.map((stage, index) => {
          const icon = stage.status === "done" ? "✓" : stage.status === "error" ? "!" : String(index + 1);
          const timing = stage.timing || (stage.status === "active" ? "Running" : stage.status === "done" ? "Completed" : stage.status === "error" ? "Failed" : "Waiting");
          const connectorClass = index === PIPELINE_STAGES.length - 1
            ? ""
            : pipelineState.stages[index + 1].status === "active" || pipelineState.stages[index + 1].status === "done"
              ? "is-active"
              : "";

          return `
            <div class="pipeline-stage ${stage.status === "active" ? "is-active" : ""} ${stage.status === "done" ? "is-done" : ""} ${stage.status === "error" ? "is-error" : ""}">
              <div class="pipeline-icon" aria-hidden="true">${icon}</div>
              <div class="pipeline-copy">
                <p class="pipeline-stage-title">${escapeHtml(stage.label)}</p>
                <p class="pipeline-stage-detail">${escapeHtml(stage.detail)}</p>
              </div>
              <span class="pipeline-stage-state">${escapeHtml(timing)}</span>
            </div>
            ${index === PIPELINE_STAGES.length - 1 ? "" : `<div class="pipeline-connector ${connectorClass}" aria-hidden="true"></div>`}
          `;
        }).join("")}
      </div>
    </div>
  ` : "";

  resultsEl.innerHTML = `
    <div class="loading-card card-lite">
      <div class="spinner" aria-hidden="true"></div>
      <div>
        <strong>${title}</strong>
        <p class="subtle">${subtitle}</p>
      </div>
    </div>
    ${pipelineHtml}
  `;
}

function clearPipelineTimers() {
  pipelineTimers.forEach((timerId) => clearTimeout(timerId));
  pipelineTimers = [];
}

function createInitialPipelineState() {
  return {
    progressLabel: "Extracting resume",
    stages: PIPELINE_STAGES.map((stage, index) => ({
      ...stage,
      status: index === 0 ? "active" : "pending",
      timing: index === 0 ? "Running" : "Waiting"
    }))
  };
}

function renderPipelineLoading(title, subtitle) {
  renderLoadingState(title, subtitle);
}

function updatePipelineStage(stageId, status, timingLabel) {
  if (!pipelineState) return;

  pipelineState = {
    ...pipelineState,
    stages: pipelineState.stages.map((stage) => {
      if (stage.id !== stageId) return stage;
      return {
        ...stage,
        status,
        timing: timingLabel || (status === "active" ? "Running" : status === "done" ? "Completed" : status === "error" ? "Failed" : "Waiting")
      };
    })
  };
}

function activatePipelineStage(stageId) {
  if (!pipelineState) return;

  pipelineState = {
    ...pipelineState,
    stages: pipelineState.stages.map((stage) => {
      if (stage.id !== stageId) return stage;
      return { ...stage, status: "active", timing: "Running" };
    })
  };
}

function getActivePipelineStage() {
  if (!pipelineState) return null;
  return pipelineState.stages.find((stage) => stage.status === "active") || null;
}

function beginPipelineFlow() {
  pipelineRunToken += 1;
  clearPipelineTimers();
  pipelineState = createInitialPipelineState();
  renderPipelineLoading("Extracting resume text...", "We are processing your uploaded PDF or DOCX file.");
  return pipelineRunToken;
}

function startAnalyzePipelineSimulation(token) {
  if (token !== pipelineRunToken || !pipelineState) return;

  updatePipelineStage("resume_extract", "done", "Completed");
  activatePipelineStage("job_extract");
  pipelineState.progressLabel = "Running analysis pipeline";
  renderPipelineLoading("Analyzing your profile...", "Each agent is working through your profile now.");

  PIPELINE_STAGES.forEach((stage, index) => {
    if (index < 1 || index >= PIPELINE_STAGES.length - 1) return;

    const timerId = setTimeout(() => {
      if (token !== pipelineRunToken || !pipelineState) return;
      updatePipelineStage(stage.id, "done", "Completed");
      activatePipelineStage(PIPELINE_STAGES[index + 1].id);
      renderPipelineLoading("Analyzing your profile...", "Each agent is working through your profile now.");
    }, PIPELINE_REVEAL_DELAY_MS + PIPELINE_STAGE_DURATION_MS * index);

    pipelineTimers.push(timerId);
  });
}

async function completePipelineFlow(token) {
  if (token !== pipelineRunToken || !pipelineState) return;

  clearPipelineTimers();
  pipelineState.stages = pipelineState.stages.map((stage) => ({ ...stage, status: "done", timing: "Completed" }));
  pipelineState.progressLabel = "Pipeline completed";
  renderPipelineLoading("Finalizing results...", "Preparing your analysis report.");

  await new Promise((resolve) => {
    const timerId = setTimeout(resolve, 220);
    pipelineTimers.push(timerId);
  });

  clearPipelineTimers();
}

function failPipelineFlow(token, message) {
  if (token !== pipelineRunToken || !pipelineState) return;

  clearPipelineTimers();
  const activeStage = getActivePipelineStage();
  const failedId = activeStage ? activeStage.id : PIPELINE_STAGES[PIPELINE_STAGES.length - 1].id;
  updatePipelineStage(failedId, "error", "Failed");
  pipelineState.progressLabel = message || "Pipeline failed";
  renderPipelineLoading("Analysis stopped", message || "One pipeline stage failed.");
}

function clearPipelineState() {
  clearPipelineTimers();
  pipelineState = null;
}

function updateSubmitAvailability() {
  const hasResumeFile = Boolean(resumeFileEl.files?.[0]);
  const hasJob = Boolean(form.job.value.trim());
  const hasConsent = Boolean(consentCheckboxEl.checked);
  submitBtn.disabled = !(hasResumeFile && hasJob && hasConsent);
}

function renderEmptyResultsState() {
  resultsEl.innerHTML = `
    <section class="card-lite empty-state">
      <strong>Find Out Your Analysis</strong>
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
    openSavedAnalysisId = id;
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

async function deleteAnalysis(id) {
  if (!id) return;

  const confirmed = window.confirm("Delete this saved analysis?");
  if (!confirmed) return;

  try {
    if (!apiBaseUrl) {
      throw new Error("API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.");
    }

    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/history/${encodeURIComponent(id)}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = payload.detail || payload.message || payload.error;
      throw new Error(detail ? `Delete failed: ${detail}` : "Delete failed.");
    }

    if (openSavedAnalysisId && openSavedAnalysisId === id) {
      hideSavedAnalysisOverlay();
    }

    await loadHistory();
  } catch (error) {
    errorEl.textContent = formatRequestError(error);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  resultsEl.innerHTML = "";

  const resumeFile = resumeFileEl.files?.[0];
  const job = form.job.value.trim();

  if (!apiBaseUrl) {
    errorEl.textContent = "API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.";
    return;
  }

  if (!resumeFile || !job) {
    errorEl.textContent = "Please upload a resume file and complete the Job Description field.";
    return;
  }

  if (!consentCheckboxEl.checked) {
    errorEl.textContent = "Please accept the privacy consent before starting analysis.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Extracting Resume...";
  const runToken = beginPipelineFlow();

  try {
    const extractFormData = new FormData();
    extractFormData.append("resume", resumeFile);

    const extractResponse = await fetch(`${apiBaseUrl}/analyze/extract`, {
      method: "POST",
      body: extractFormData
    });

    if (!extractResponse.ok) {
      const payload = await extractResponse.json().catch(() => ({}));
      const detail = payload.detail || payload.message || payload.error;
      throw new Error(detail ? `Resume extraction failed: ${detail}` : `Resume extraction failed (${extractResponse.status}).`);
    }

    const extracted = await extractResponse.json();
    const resume = String(extracted?.text || "").trim();
    if (!resume) {
      throw new Error("Resume extraction produced empty text. Please upload a text-based PDF or DOCX file.");
    }

    submitBtn.textContent = "Analyzing...";
    startAnalyzePipelineSimulation(runToken);

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
    await completePipelineFlow(runToken);
    clearPipelineState();
    renderResults(data);
    await loadHistory();
  } catch (error) {
    failPipelineFlow(runToken, "Unable to complete all stages. Please retry.");
    errorEl.textContent = formatRequestError(error);
  } finally {
    updateSubmitAvailability();
    submitBtn.textContent = "Start AI Analysis";
  }
});

navDashboardBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("dashboard");
});

navNewAnalysisBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("analysis");
});

viewAnalysisBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("analysis");
  resumeFileEl.focus();
});

resumeFileEl.addEventListener("change", () => {
  const file = resumeFileEl.files?.[0];
  if (!file) {
    resumeFileStatusEl.textContent = "No file selected.";
    updateSubmitAvailability();
    return;
  }

  const kb = Math.max(1, Math.round(file.size / 1024));
  resumeFileStatusEl.textContent = `${file.name} (${kb} KB)`;
  updateSubmitAvailability();
});

consentCheckboxEl.addEventListener("change", () => {
  updateSubmitAvailability();
});

form.job.addEventListener("input", () => {
  updateSubmitAvailability();
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
  const deleteBtn = event.target.closest("[data-action='delete-analysis']");
  if (deleteBtn) {
    event.preventDefault();
    event.stopPropagation();
    const id = deleteBtn.getAttribute("data-analysis-id") || "";
    deleteAnalysis(id);
    return;
  }

  const card = event.target.closest("[data-analysis-id]");
  if (!card) return;

  const id = card.getAttribute("data-analysis-id") || "";
  openSavedAnalysis(id);
});

filterMinScoreEl.addEventListener("input", () => {
  scheduleHistoryReload();
});

filterMaxScoreEl.addEventListener("input", () => {
  scheduleHistoryReload();
});

filterDateRangeEl.addEventListener("change", () => {
  loadHistory();
});

resetHistoryFiltersBtn.addEventListener("click", () => {
  filterMinScoreEl.value = "0";
  filterMaxScoreEl.value = "100";
  filterDateRangeEl.value = "all";
  loadHistory();
});

dashboardHistoryEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  if (event.target.closest("[data-action='delete-analysis']")) {
    return;
  }

  const card = event.target.closest("[data-analysis-id]");
  if (!card) return;

  event.preventDefault();
  const id = card.getAttribute("data-analysis-id") || "";
  openSavedAnalysis(id);
});

renderEmptyResultsState();
setActiveView(getInitialView());
loadHistory();
updateSubmitAvailability();
