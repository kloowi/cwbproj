import "./styles.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = (configuredApiBaseUrl || (window.location.hostname === "localhost" ? "http://localhost:5050" : "")).replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";
const ACTIVE_VIEW_KEY = "jobpilot_active_view";
const ROADMAP_PROGRESS_KEY = "jobpilot_roadmap_progress_v1";
const PIPELINE_STAGE_DURATION_MS = 1100;
const PIPELINE_REVEAL_DELAY_MS = 280;
const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".docx"];

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
      <div class="brand-wrap">
        <div class="brand-head">
          <div class="brand-chip" aria-hidden="true">
            <span class="material-symbols-outlined">hive</span>
          </div>
          <div>
            <h1 class="brand-title">CareerHive</h1>
            <p class="brand-subtitle">AI Copilot</p>
          </div>
        </div>
      </div>
      <nav class="nav-group" aria-label="Primary Navigation">
        <button class="nav-item" type="button" id="nav-dashboard">
          <span class="material-symbols-outlined nav-icon" aria-hidden="true">dashboard</span>
          <span class="nav-label">Dashboard</span>
        </button>
        <button class="nav-item nav-active" type="button" id="nav-new-analysis">
          <span class="material-symbols-outlined nav-icon" aria-hidden="true">analytics</span>
          <span class="nav-label">Add Analysis</span>
        <button class="nav-item" type="button" id="nav-interview-prep">
          <span class="material-symbols-outlined nav-icon" aria-hidden="true">psychology</span>
          <span class="nav-label">Interview Prep</span>
        </button>
      </nav>
    </aside>

    <main class="workspace">
      <section class="dashboard-view view-hidden" id="dashboard-view" aria-label="Dashboard">
        <header class="dashboard-hero">
          <div class="dashboard-hero-copy">
            <p class="dashboard-hero-kicker">CareerHive AI</p>
            <h2>Design your next move with clarity.</h2>
            <p>Turn your resume and target role into concrete, score-backed next steps.</p>
          </div>
          <div class="dashboard-hero-highlight" aria-hidden="true">
            <p>Pipeline</p>
            <strong>Resume -> Match -> Plan</strong>
            <span>Track every analysis and focus on the highest-impact skill gaps.</span>
          </div>
        </header>

        <section class="dashboard-panel dashboard-overview-panel">
          <div class="section-label">Dashboard Overview</div>
          <div class="dashboard-stats" id="dashboard-stats"></div>
        </section>

        <section class="dashboard-panel dashboard-history-panel" aria-label="Application History">
          <div class="history-head">
            <div>
              <h3>Recent Analyses</h3>
              <p class="history-head-sub">Review your latest role-fit snapshots and reopen any saved report.</p>
            </div>
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
          </div>
          <div id="dashboard-history"></div>
        </section>
      </section>

      <section class="analysis-view" id="analysis-view">
        <section class="panel" aria-label="Analysis Input">
          <div class="analysis-intro">
            <p class="analysis-kicker">CareerHive Analyzer</p>
            <h2>Start a New Analysis</h2>
            <p>Compare your professional profile with specific job requirements to optimize your chances and discover critical skill gaps.</p>
          </div>
          <form id="analyze-form" class="input-grid">
            <section class="input-card analysis-upload-card">
              <div class="input-card-head">
                <h3>
                  <span class="card-title-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false" role="presentation">
                      <path d="M12 3.5v11M7.5 8l4.5-4.5L16.5 8M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  Upload Resume
                </h3>
              </div>
              <p class="input-card-copy">PDF or DOCX (Max 5MB)</p>
              <div class="input-zone upload-zone">
                <p class="upload-zone-copy">Drop your resume here or select a file from your device.</p>
                <span class="upload-zone-divider" aria-hidden="true"><span></span><strong>or</strong><span></span></span>
                <label class="browse-files-btn" for="resume-file">Browse Files</label>
                <input id="resume-file" name="resumeFile" class="sr-only-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
              </div>
              <p class="file-status-pill is-idle" id="resume-file-status" role="status" aria-live="polite">No file selected</p>
            </section>

            <section class="input-card analysis-job-card">
              <div class="input-card-head">
                <h3>
                  <span class="card-title-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false" role="presentation">
                      <path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v10A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5ZM8.5 9h7M8.5 12h7M8.5 15h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  Job Description
                </h3>
              </div>
              <p class="input-card-copy">Enter job title only or full description.</p>
              <textarea id="job" name="job" class="input-zone" placeholder="Example: We are looking for a Senior Product Designer with 5+ years of experience in Figma, React, and UX research. The ideal candidate must..."></textarea>
            </section>

            <div class="form-actions consent-card">
              <label class="consent-row" for="consent-checkbox">
                <input id="consent-checkbox" name="consent" type="checkbox" />
                <span class="consent-copy">I consent to the collection and analysis of my uploaded resume and job application data.</span>
              </label>
              <div class="submit-row">
                <button id="submit-btn" type="submit" class="primary-btn">Analyze with CareerHive AI</button>
              </div>
            </div>
          </form>
          <div id="error" class="error"></div>
        </section>

        <section class="results-panel view-hidden" id="analysis-results-panel" aria-label="Analysis Results" aria-hidden="true">
          <div class="section-label">Analysis Results</div>
          <div id="results"></div>
        </section>
      </section>

      <section class="interview-prep-view view-hidden" id="interview-prep-view" aria-label="Interview Prep">
        <section class="panel" aria-label="Interview Prep Landing">
          <div class="interview-prep-intro">
            <h2>Start Your Interview Preparation</h2>
            <p>Choose a role to generate a tailored preparation session.</p>
          </div>

          <div class="interview-prep-actions" aria-label="Interview Prep Primary Actions">
            <button type="button" class="interview-prep-action-card interview-prep-analyze-card" id="interview-prep-analyze-role-btn" aria-label="Analyze new role to start interview preparation">
              <span class="interview-prep-action-icon" aria-hidden="true">
                <span class="material-symbols-outlined">upload_file</span>
              </span>
              <h3>Analyze New Role</h3>
              <p>Upload a new job description and get an instant AI-powered preparation roadmap.</p>
              <span class="interview-prep-action-cta">Start from scratch <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span>
            </button>

            <button type="button" class="interview-prep-action-card interview-prep-browse-card" id="interview-prep-browse-roles-btn" aria-label="Browse predefined roles for interview preparation">
              <span class="interview-prep-action-icon" aria-hidden="true">
                <span class="material-symbols-outlined">travel_explore</span>
              </span>
              <h3>Browse Roles</h3>
              <p>Explore the "Hive" for predefined industry roles and common interview patterns.</p>
              <span class="interview-prep-action-cta">Go to Hive <span class="material-symbols-outlined" aria-hidden="true">hive</span></span>
            </button>
          </div>
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
const analysisResultsPanelEl = document.querySelector("#analysis-results-panel");
const dashboardStatsEl = document.querySelector("#dashboard-stats");
const dashboardHistoryEl = document.querySelector("#dashboard-history");
const dashboardViewEl = document.querySelector("#dashboard-view");
const analysisViewEl = document.querySelector("#analysis-view");
const interviewPrepViewEl = document.querySelector("#interview-prep-view");
const navDashboardBtn = document.querySelector("#nav-dashboard");
const navNewAnalysisBtn = document.querySelector("#nav-new-analysis");
const navInterviewPrepBtn = document.querySelector("#nav-interview-prep");
const interviewPrepAnalyzeRoleBtn = document.querySelector("#interview-prep-analyze-role-btn");
const interviewPrepBrowseRolesBtn = document.querySelector("#interview-prep-browse-roles-btn");
const filterMinScoreEl = document.querySelector("#filter-min-score");
const filterMaxScoreEl = document.querySelector("#filter-max-score");
const filterDateRangeEl = document.querySelector("#filter-date-range");
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
let resumeFileIsValid = false;
let latestMainReportData = null;
let latestMainReportOptions = null;
let latestSavedReportData = null;
let latestSavedReportOptions = null;
const roadmapProgressState = loadRoadmapProgressState();

function loadRoadmapProgressState() {
  try {
    const raw = localStorage.getItem(ROADMAP_PROGRESS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch (_error) {
    return {};
  }
}

function persistRoadmapProgressState() {
  try {
    localStorage.setItem(ROADMAP_PROGRESS_KEY, JSON.stringify(roadmapProgressState));
  } catch (_error) {
  }
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function resolveAnalysisId(data, options = {}) {
  const explicit = String(options.analysisId || data?.meta?.analysisId || data?.id || "").trim();
  if (explicit) return explicit;

  const fallbackFingerprint = JSON.stringify({
    title: data?.job?.title || "",
    roadmap: data?.plan?.roadmap || [],
    missing: data?.match?.missing || [],
    strengths: data?.match?.strengths || []
  });

  return `analysis-${hashString(fallbackFingerprint)}`;
}

function ensureRoadmapProgress(analysisId, stepCount) {
  if (!roadmapProgressState[analysisId] || typeof roadmapProgressState[analysisId] !== "object") {
    roadmapProgressState[analysisId] = {};
  }

  const nextState = { ...roadmapProgressState[analysisId] };
  let changed = false;

  for (let index = 1; index < stepCount; index += 1) {
    const key = String(index);
    if (typeof nextState[key] !== "boolean") {
      nextState[key] = false;
      changed = true;
    }
  }

  if (Object.keys(nextState).length !== Object.keys(roadmapProgressState[analysisId]).length) {
    changed = true;
  }

  roadmapProgressState[analysisId] = nextState;
  if (changed) {
    persistRoadmapProgressState();
  }
}

function setRoadmapStepCompletion(analysisId, stepIndex, isCompleted) {
  if (stepIndex <= 0) return;
  if (!roadmapProgressState[analysisId] || typeof roadmapProgressState[analysisId] !== "object") {
    roadmapProgressState[analysisId] = {};
  }

  roadmapProgressState[analysisId][String(stepIndex)] = Boolean(isCompleted);
  persistRoadmapProgressState();
}

function resetRoadmapCompletion(analysisId) {
  if (!roadmapProgressState[analysisId] || typeof roadmapProgressState[analysisId] !== "object") return;

  Object.keys(roadmapProgressState[analysisId]).forEach((stepIndex) => {
    roadmapProgressState[analysisId][stepIndex] = false;
  });

  persistRoadmapProgressState();
}

function getRoadmapStepCompletion(analysisId, stepIndex) {
  if (stepIndex <= 0) return true;
  return Boolean(roadmapProgressState[analysisId]?.[String(stepIndex)]);
}

function buildRoadmapCompleteButtonMarkup(step, index, analysisId) {
  return `<button class="roadmap-complete-btn" type="button" data-roadmap-action="complete" data-roadmap-step-index="${index}" data-roadmap-analysis-id="${escapeHtml(analysisId)}" aria-label="Mark ${escapeHtml(step.title)} as done">Mark done</button>`;
}

function buildRoadmapActionPlaceholderMarkup() {
  return "<span class=\"roadmap-action-placeholder\" aria-hidden=\"true\">Mark done</span>";
}

function updateRoadmapCardUi(roadmapCardEl, analysisId) {
  if (!roadmapCardEl || !analysisId) return;

  const rows = Array.from(roadmapCardEl.querySelectorAll(".roadmap-item"));
  if (!rows.length) return;

  const firstIncompleteIndex = rows.findIndex((row, index) => index > 0 && !getRoadmapStepCompletion(analysisId, index));
  let completedCount = 0;

  rows.forEach((row, index) => {
    const isDone = index === 0 ? true : getRoadmapStepCompletion(analysisId, index);
    const isActive = index > 0 && index === firstIncompleteIndex;
    const nextClass = isDone ? "is-done" : isActive ? "is-active" : "is-upcoming";
    const labelText = isDone ? "Completed" : isActive ? "In Progress" : "Locked";
    const labelClass = isDone ? "is-complete" : isActive ? "is-progress" : "is-locked";

    if (isDone) completedCount += 1;

    row.classList.remove("is-done", "is-active", "is-upcoming");
    row.classList.add(nextClass);

    const checkEl = row.querySelector(".roadmap-check");
    if (checkEl) {
      checkEl.textContent = isDone ? "v" : "";
    }

    const stateEl = row.querySelector(".roadmap-state");
    if (stateEl) {
      stateEl.textContent = labelText;
      stateEl.classList.remove("is-complete", "is-progress", "is-locked");
      stateEl.classList.add(labelClass);
    }

    const actionsEl = row.querySelector(".roadmap-actions");
    if (actionsEl) {
      if (index > 0 && !isDone && isActive) {
        const titleEl = row.querySelector(".roadmap-title");
        actionsEl.innerHTML = buildRoadmapCompleteButtonMarkup({ title: titleEl?.textContent || "action" }, index, analysisId);
      } else {
        actionsEl.innerHTML = buildRoadmapActionPlaceholderMarkup();
      }
    }
  });

  const progressEl = roadmapCardEl.querySelector(".roadmap-progress");
  if (progressEl) {
    progressEl.textContent = `${completedCount} of ${rows.length} completed`;
  }
}

function setResumeFileStatus(message, state) {
  resumeFileStatusEl.textContent = message;
  resumeFileStatusEl.classList.remove("is-idle", "is-ready", "is-error");
  resumeFileStatusEl.classList.add(state);
}

function hasAllowedResumeExtension(fileName) {
  const lower = String(fileName || "").toLowerCase();
  return ALLOWED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function setActiveView(view) {
  const normalizedView = view === "dashboard"
    ? "dashboard"
    : view === "interview-prep"
      ? "interview-prep"
      : "analysis";
  const showDashboard = normalizedView === "dashboard";
  const showInterviewPrep = normalizedView === "interview-prep";
  dashboardViewEl.classList.toggle("view-hidden", !showDashboard);
  analysisViewEl.classList.toggle("view-hidden", showDashboard || showInterviewPrep);
  interviewPrepViewEl.classList.toggle("view-hidden", !showInterviewPrep);
  navDashboardBtn.classList.toggle("nav-active", showDashboard);
  navNewAnalysisBtn.classList.toggle("nav-active", !showDashboard && !showInterviewPrep);
  navInterviewPrepBtn.classList.toggle("nav-active", showInterviewPrep);

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

const SKILL_DISPLAY_MAP = {
  ai: "AI",
  api: "API",
  apis: "APIs",
  aws: "AWS",
  azure: "Azure",
  cicd: "CI/CD",
  gcp: "GCP",
  gke: "GKE",
  github: "GitHub",
  graphql: "GraphQL",
  java: "Java",
  javascript: "JavaScript",
  llm: "LLM",
  ml: "ML",
  mongodb: "MongoDB",
  mysql: "MySQL",
  nodejs: "Node.js",
  nosql: "NoSQL",
  nlp: "NLP",
  postgresql: "PostgreSQL",
  react: "React",
  rest: "REST",
  sql: "SQL",
  typescript: "TypeScript",
  uiux: "UI/UX"
};

function formatSkillDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const directKey = raw.toLowerCase().replace(/\s+/g, " ");
  const compactKey = directKey.replace(/[\s._-]/g, "");

  if (SKILL_DISPLAY_MAP[directKey]) {
    return SKILL_DISPLAY_MAP[directKey];
  }

  if (SKILL_DISPLAY_MAP[compactKey]) {
    return SKILL_DISPLAY_MAP[compactKey];
  }

  return toTitleCase(raw);
}

function toSentenceCase(text) {
  if (!text) return "";
  const normalized = text.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatHistoryDateTime(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(" ", "");

  return `${datePart} at ${timePart}`;
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
      provider: item?.provider || "unknown",
      analysisId: String(item?.id || "").trim()
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
    if (stored === "dashboard" || stored === "analysis" || stored === "interview-prep") {
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

function getScoreProfile(score) {
  if (score >= 80) {
    return {
      headline: "High Alignment",
      toneClass: "is-good",
      pillLabel: "Strong Fit",
      summary: "Your resume aligns with most role requirements. Focus on polishing evidence and impact language."
    };
  }

  if (score >= 60) {
    return {
      headline: "Promising Match",
      toneClass: "is-mid",
      pillLabel: "Promising Fit",
      summary: "You meet a solid share of requirements. Closing a few skill gaps can meaningfully improve your odds."
    };
  }

  return {
    headline: "Gap to Close",
    toneClass: "is-low",
    pillLabel: "Needs Work",
    summary: "There is a meaningful mismatch today. Prioritize the top gaps first, then re-run the analysis."
  };
}

function formatSkillList(items) {
  return (items || [])
    .map((item) => formatSkillDisplay(item))
    .filter(Boolean);
}

function buildActionableItems(missingSkills, roadmapItems) {
  const fromRoadmap = roadmapItems
    .map((item) => toSentenceCase(String(item || "")))
    .filter(Boolean)
    .slice(0, 3);

  if (fromRoadmap.length) return fromRoadmap;

  const fromGaps = missingSkills.slice(0, 3).map((skill) => `Add concrete evidence of ${skill} with one measurable bullet.`);
  if (fromGaps.length) return fromGaps;

  return ["Add one quantified accomplishment to improve recruiter confidence."];
}

function buildRoadmapSteps(roadmapItems, missingSkills) {
  const normalizedRoadmap = roadmapItems
    .map((item) => toSentenceCase(String(item || "")))
    .filter(Boolean);

  const fallbackRoadmap = missingSkills.slice(0, 3).map((skill) => `Build project proof for ${skill}.`);
  const backlog = (normalizedRoadmap.length ? normalizedRoadmap : fallbackRoadmap).slice(0, 4);

  const baseStep = {
    title: "Resume uploaded and parsed",
    detail: "Baseline profile extracted and ready for targeted optimization.",
    priority: "Low",
    done: true
  };

  const steps = [baseStep];
  backlog.forEach((item, index) => {
    let priority = "Low";
    if (index === 0) priority = "High";
    else if (index < 3) priority = "Medium";

    steps.push({
      title: item,
      detail: "Directly connected to this role's requirements.",
      priority,
      done: false
    });
  });

  return steps;
}

function renderAnalysisReport(data, options = {}) {
  const analysisId = resolveAnalysisId(data, options);
  const title = escapeHtml(options.title || data.job?.title || "Role Analysis");
  const score = Math.max(0, Math.min(100, Number(data.match?.score || 0)));
  const profile = getScoreProfile(score);
  const missingSkills = formatSkillList(data.match?.missing);
  const strengths = formatSkillList(data.match?.strengths);
  const roadmapItems = (data.plan?.roadmap || []).map((item) => String(item || ""));
  const reasoning = escapeHtml(toSentenceCase(data.match?.reasoning || ""));
  const actionItems = buildActionableItems(missingSkills, roadmapItems);
  const roadmapSteps = buildRoadmapSteps(roadmapItems, missingSkills);
  ensureRoadmapProgress(analysisId, roadmapSteps.length);

  const roadmapUiSteps = roadmapSteps.map((step, index) => {
    if (index === 0) {
      return { ...step, done: true, isToggleable: false };
    }

    return {
      ...step,
      done: Boolean(roadmapProgressState[analysisId]?.[String(index)]),
      isToggleable: true
    };
  });

  const matchedCount = strengths.length;
  const missingCount = missingSkills.length;
  const completedCount = roadmapUiSteps.filter((item) => item.done).length;
  const previewResume = escapeHtml(options.resumeSnippet || "Resume preview is unavailable for this record.");
  const previewJob = escapeHtml(options.jobSnippet || "Job description preview is unavailable for this record.");

  const improvementsMarkup = actionItems
    .map(
      (item, index) => `<li class="action-item">
        <span class="action-icon" aria-hidden="true">${index === 0 ? "+" : index === 1 ? "#" : ">"}</span>
        <div>
          <p class="action-title">${escapeHtml(toSentenceCase(item))}</p>
          <p class="action-sub">Tighten this area to improve role fit and ATS confidence.</p>
        </div>
      </li>`
    )
    .join("");

  const gapsMarkup = missingSkills.length
    ? missingSkills.map((item) => `<li><span class="skill-dot" aria-hidden="true"></span>${escapeHtml(item)}</li>`).join("")
    : "<li><span class=\"skill-dot\" aria-hidden=\"true\"></span>No critical gaps detected</li>";

  const strengthsMarkup = strengths.length
    ? strengths.map((item) => `<li><span class="skill-dot" aria-hidden="true"></span>${escapeHtml(item)}</li>`).join("")
    : "<li><span class=\"skill-dot\" aria-hidden=\"true\"></span>Strength signals unavailable</li>";

  const activeRoadmapIndex = roadmapUiSteps.findIndex((step) => !step.done);
  const roadmapMarkup = roadmapUiSteps
    .map((step, index) => {
      const priorityClass = step.priority === "High" ? "is-high" : step.priority === "Medium" ? "is-medium" : "is-low";
      const stateClass = step.done ? "is-done" : index === activeRoadmapIndex ? "is-active" : "is-upcoming";
      const stateLabel = step.done ? "Completed" : index === activeRoadmapIndex ? "In Progress" : "Locked";
      const stateLabelClass = step.done ? "is-complete" : index === activeRoadmapIndex ? "is-progress" : "is-locked";
      const showCompleteButton = step.isToggleable && !step.done && index === activeRoadmapIndex;
      const toggleControlMarkup = showCompleteButton
        ? buildRoadmapCompleteButtonMarkup(step, index, analysisId)
        : buildRoadmapActionPlaceholderMarkup();
      return `<li class="roadmap-item ${stateClass}" data-roadmap-step-index="${index}">
        <span class="roadmap-check" aria-hidden="true">${step.done ? "v" : ""}</span>
        <div class="roadmap-main">
          <p class="roadmap-title">${escapeHtml(step.title)}</p>
          <div class="roadmap-meta">
            <span class="priority-pill ${priorityClass}">${step.priority} Priority</span>
            <span class="roadmap-state ${stateLabelClass}">${stateLabel}</span>
          </div>
        </div>
        <div class="roadmap-actions">${toggleControlMarkup}</div>
      </li>`;
    })
    .join("");

  const secondaryCardMarkup = options.includeInputPreview
    ? `<section class="card-lite report-card">
      <h3>Saved Input Preview</h3>
      <p class="saved-snippet-label">Resume</p>
      <p class="saved-snippet">${previewResume}</p>
      <p class="saved-snippet-label">Job Description</p>
      <p class="saved-snippet">${previewJob}</p>
    </section>`
    : "";

  const nextStepMarkup = `<div class="section-label">Next Step</div>
    <section class="card-lite report-card next-step-card" aria-label="Next step">
      <div class="next-step-content">
        <h3 class="next-step-title">Interview Preparation</h3>
        <p class="next-step-subtext">Practice real interview scenarios with AI-generated questions.</p>
      </div>
      <div class="next-step-actions">
        <button class="next-step-cta" type="button">Prepare Now →</button>
      </div>
    </section>`;

  return `
    ${options.kicker ? `<div class="saved-report-kicker">${escapeHtml(options.kicker)}</div>` : ""}
    <div class="report-title-row">
      <h3>${title}</h3>
      <p>Cross-referenced against this role's key requirements to produce clear next actions.</p>
    </div>

    <div class="report-grid" aria-live="polite">
      <section class="score-card card-lite report-card">
        <div class="score-header-chip ${profile.toneClass}">${profile.pillLabel}</div>
        <div class="score-ring" role="img" aria-label="Match score ${score} percent" style="--score:${score}">
          <span>${score}%</span>
        </div>
        <div class="score-caption">${profile.headline}</div>
        <p class="score-text">${reasoning || escapeHtml(profile.summary)}</p>

        <div class="explain-strip" aria-label="Score explanation">
          <div>
            <p class="explain-value">${matchedCount}</p>
            <p class="explain-label">Matched</p>
          </div>
          <div>
            <p class="explain-value">${missingCount}</p>
            <p class="explain-label">Gaps</p>
          </div>
          <div>
            <p class="explain-value">${roadmapSteps.length - completedCount}</p>
            <p class="explain-label">Actions</p>
          </div>
        </div>
      </section>

      <section class="card-lite report-card improvements-card">
        <div class="insight-head">
          <h3><span class="section-mark" aria-hidden="true">+</span>Actionable Resume Improvements</h3>
        </div>
        <ul class="action-list">${improvementsMarkup}</ul>
      </section>

      <section class="card-lite report-card gaps-card">
        <div class="insight-head">
          <h3><span class="section-mark" aria-hidden="true">></span>Priority Skill Gaps</h3>
        </div>
        <ul class="pill-list gap-cloud">${gapsMarkup}</ul>
        <p class="meta">Closing these gaps should improve keyword relevance and interview readiness.</p>
      </section>

      <section class="card-lite report-card strengths-card">
        <div class="insight-head">
          <h3><span class="section-mark" aria-hidden="true">+</span>Strength Highlights</h3>
        </div>
        <ul class="pill-list gap-cloud strength-cloud">${strengthsMarkup}</ul>
        <p class="meta">Building on these strengths should improve confidence and interview performance.</p>
      </section>

      <section class="card-lite report-card roadmap-card">
        <div class="insight-head">
          <h3><span class="section-mark" aria-hidden="true">◉</span>Your Application Roadmap</h3>
          <span class="roadmap-progress">${completedCount} of ${roadmapUiSteps.length} completed</span>
        </div>
        <ol class="roadmap-list">${roadmapMarkup}</ol>
        <button class="roadmap-reset-btn" type="button" data-roadmap-action="reset" data-roadmap-analysis-id="${escapeHtml(analysisId)}">Reset actions</button>
      </section>
    </div>

    ${secondaryCardMarkup ? `<div class="results-grid secondary report-secondary is-single">${secondaryCardMarkup}</div>` : ""}
    <div class="report-secondary next-step-section">${nextStepMarkup}</div>
  `;
}

function renderSavedAnalysisOverlay(data) {
  latestSavedReportData = data;
  latestSavedReportOptions = {
    title: data.job?.title || "Role Analysis",
    kicker: "Saved Snapshot",
    includeInputPreview: true,
    resumeSnippet: data.input?.resumeSnippet,
    jobSnippet: data.input?.jobSnippet,
    analysisId: data.meta?.analysisId || ""
  };

  showSavedAnalysisOverlay(
    renderAnalysisReport(data, {
      ...latestSavedReportOptions
    })
  );
}

function renderDashboard(items) {
  if (!items.length) {
    dashboardStatsEl.innerHTML = `
      <article class="stat-card card-lite">
        <div class="stat-head">
          <p class="stat-label">Applications Sent</p>
          <span class="stat-trend is-neutral">No data</span>
        </div>
        <p class="stat-value">0</p>
        <p class="stat-foot">Run your first analysis to populate this dashboard.</p>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">send</span>
        </div>
      </article>
      <article class="stat-card card-lite">
        <div>
          <div class="stat-head">
            <p class="stat-label">Average Match Score</p>
            <span class="stat-trend is-neutral">No data</span>
          </div>
          <p class="stat-value">0%</p>
          <p class="stat-foot">We calculate this after at least one completed analysis.</p>
        </div>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">analytics</span>
        </div>
      </article>
      <article class="stat-card card-lite">
        <div>
          <div class="stat-head">
            <p class="stat-label">Best Match Score</p>
            <span class="stat-trend is-neutral">No data</span>
          </div>
          <p class="stat-value">0%</p>
          <p class="stat-foot">Your strongest role-fit snapshot will appear here.</p>
        </div>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">verified</span>
        </div>
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
  const strongFits = scoreValues.filter((value) => value >= 85).length;
  const promisingFits = scoreValues.filter((value) => value >= 65 && value < 85).length;

  const avgTrendClass = avgScore >= 80 ? "is-good" : avgScore >= 60 ? "is-mid" : "is-low";
  const avgTrendLabel = avgScore >= 80 ? "Strong" : avgScore >= 60 ? "Promising" : "Needs work";
  const topTrendClass = topScore >= 85 ? "is-good" : topScore >= 65 ? "is-mid" : "is-low";
  const topTrendLabel = topScore >= 85 ? "Top fit" : topScore >= 65 ? "Growing" : "Early";

  dashboardStatsEl.innerHTML = `
    <article class="stat-card card-lite">
      <div class="stat-head">
        <p class="stat-label">Applications Sent</p>
        <span class="stat-trend is-neutral">${strongFits} strong</span>
      </div>
      <p class="stat-value">${totalApplications}</p>
      <p class="stat-foot">${promisingFits} additional analyses are in promising range.</p>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">send</span>
      </div>
    </article>
    <article class="stat-card card-lite">
      <div>
        <div class="stat-head">
          <p class="stat-label">Average Match Score</p>
          <span class="stat-trend ${avgTrendClass}">${avgTrendLabel}</span>
        </div>
        <p class="stat-value">${avgScore}%</p>
        <p class="stat-foot">Based on the latest ${totalApplications} saved analyses.</p>
      </div>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">analytics</span>
      </div>
    </article>
    <article class="stat-card card-lite">
      <div>
        <div class="stat-head">
          <p class="stat-label">Best Match Score</p>
          <span class="stat-trend ${topTrendClass}">${topTrendLabel}</span>
        </div>
        <p class="stat-value">${topScore}%</p>
        <p class="stat-foot">Your strongest role-fit benchmark so far.</p>
      </div>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">verified</span>
      </div>
    </article>
  `;

  dashboardHistoryEl.innerHTML = `<div class="history-grid">${items.slice(0, 8).map((item) => {
    const missing = (item.missingSkills || []).map(formatSkillDisplay);
    const date = formatHistoryDateTime(item.createdAt);
    const score = Math.max(0, Math.min(100, Number(item.matchScore || 0)));
    const status = score >= 85 ? "Strong Match" : score >= 65 ? "Promising" : "Needs Work";
    const statusClass = score >= 85 ? "is-strong" : score >= 65 ? "is-promising" : "is-needs-work";
    const meterColor = score >= 85 ? "#22c55e" : score >= 65 ? "#f59e0b" : "#f97316";
    const title = inferJobTitle(item);
    const skillsPreview = missing.slice(0, 2).join(", ") || "No major gaps detected";
    const contextPreview = String(item.jobSnippet || "").replace(/\s+/g, " ").trim();
    const rolePreview = contextPreview ? `Job preview: ${escapeHtml(contextPreview.slice(0, 90))}` : "Job preview unavailable";

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
              <span class="history-chip ${statusClass}">${status}</span>
            </div>
            <p class="history-sub"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${date}</p>
            <p class="history-gaps">Skill gaps: ${skillsPreview}</p>
            <p class="history-context">${rolePreview}</p>
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
            <span style="--score:${score};--meter-color:${meterColor}"></span>
          </div>
          <strong>${score}%</strong>
          <span class="history-open-label">Open report</span>
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
  setAnalysisResultsPanelVisibility(true);
  const pipelineHtml = pipelineState
    ? `
      <div class="pipeline-track" aria-live="polite" aria-label="Analysis stage progress">
        ${pipelineState.stages.map((stage, index) => {
          const icon = stage.status === "done" ? "✓" : stage.status === "error" ? "!" : String(index + 1);
          const connectorClass = index === PIPELINE_STAGES.length - 1
            ? ""
            : pipelineState.stages[index + 1].status === "active" || pipelineState.stages[index + 1].status === "done"
              ? "is-active"
              : "";

          return `
            <div class="pipeline-stage ${stage.status === "active" ? "is-active" : ""} ${stage.status === "done" ? "is-done" : ""} ${stage.status === "error" ? "is-error" : ""}" data-stage-id="${escapeHtml(stage.id)}">
              <div class="pipeline-icon" aria-hidden="true">${icon}</div>
              <div class="pipeline-copy">
                <p class="pipeline-stage-title">${escapeHtml(stage.label)}</p>
                <p class="pipeline-stage-detail">${escapeHtml(stage.detail)}</p>
              </div>
            </div>
            ${index === PIPELINE_STAGES.length - 1 ? "" : `<div class="pipeline-connector ${connectorClass}" aria-hidden="true"></div>`}
          `;
        }).join("")}
      </div>
    `
    : `
      <section class="card-lite empty-state">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(subtitle)}</p>
      </section>
    `;

  resultsEl.innerHTML = pipelineHtml;
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
  submitBtn.disabled = !(hasResumeFile && hasJob && hasConsent && resumeFileIsValid);
}

function setAnalysisResultsPanelVisibility(isVisible) {
  analysisResultsPanelEl.classList.toggle("view-hidden", !isVisible);
  analysisResultsPanelEl.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

function renderEmptyResultsState() {
  setAnalysisResultsPanelVisibility(true);
  resultsEl.innerHTML = `
    <section class="card-lite empty-state">
      <strong>Find Out Your Analysis</strong>
      <p>Results will appear here after you provide both a resume and a target job description.</p>
    </section>
  `;
}

function renderResults(data, options = {}) {
  setAnalysisResultsPanelVisibility(true);
  latestMainReportData = data;
  latestMainReportOptions = {
    title: data.job?.title || "Role Analysis",
    includeInputPreview: false,
    analysisId: options.analysisId || data.meta?.analysisId || data.id || ""
  };

  resultsEl.innerHTML = renderAnalysisReport(data, latestMainReportOptions);
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

  if (!resumeFileIsValid) {
    errorEl.textContent = "Please upload a valid PDF or DOCX file up to 5 MB.";
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
    submitBtn.textContent = "Analyze with CareerHive AI";
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

navInterviewPrepBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setActiveView("interview-prep");
});

interviewPrepAnalyzeRoleBtn.addEventListener("click", () => {
  setActiveView("analysis");
  resumeFileEl.focus();
});

interviewPrepBrowseRolesBtn.addEventListener("click", () => {
  // Placeholder for upcoming predefined-role browsing flow.
});

resumeFileEl.addEventListener("change", () => {
  const file = resumeFileEl.files?.[0];
  if (!file) {
    resumeFileIsValid = false;
    setResumeFileStatus("No file selected", "is-idle");
    updateSubmitAvailability();
    return;
  }

  const isAllowedType = hasAllowedResumeExtension(file.name)
    || file.type === "application/pdf"
    || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!isAllowedType) {
    resumeFileIsValid = false;
    setResumeFileStatus("Unsupported format. Use PDF or DOCX.", "is-error");
    updateSubmitAvailability();
    return;
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    resumeFileIsValid = false;
    setResumeFileStatus("File is too large. Maximum size is 5 MB.", "is-error");
    updateSubmitAvailability();
    return;
  }

  const kb = Math.max(1, Math.round(file.size / 1024));
  resumeFileIsValid = true;
  setResumeFileStatus(`${file.name} (${kb} KB)`, "is-ready");
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

function handleRoadmapInteraction(event) {
  const completeButton = event.target.closest("[data-roadmap-action='complete']");
  if (completeButton) {
    event.preventDefault();
    const analysisId = String(completeButton.getAttribute("data-roadmap-analysis-id") || "").trim();
    const stepIndex = Number(completeButton.getAttribute("data-roadmap-step-index"));
    if (!analysisId || !Number.isInteger(stepIndex) || stepIndex <= 0) return true;

    setRoadmapStepCompletion(analysisId, stepIndex, true);
    const roadmapCardEl = completeButton.closest(".roadmap-card");
    updateRoadmapCardUi(roadmapCardEl, analysisId);
    return true;
  }

  const resetButton = event.target.closest("[data-roadmap-action='reset']");
  if (resetButton) {
    event.preventDefault();
    const analysisId = String(resetButton.getAttribute("data-roadmap-analysis-id") || "").trim();
    if (!analysisId) return true;

    resetRoadmapCompletion(analysisId);
    const roadmapCardEl = resetButton.closest(".roadmap-card");
    updateRoadmapCardUi(roadmapCardEl, analysisId);
    return true;
  }

  return false;
}

resultsEl.addEventListener("click", (event) => {
  handleRoadmapInteraction(event);
});

savedReportContentEl.addEventListener("click", (event) => {
  handleRoadmapInteraction(event);
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

setAnalysisResultsPanelVisibility(false);
setActiveView(getInitialView());
loadHistory();
setResumeFileStatus("No file selected", "is-idle");
updateSubmitAvailability();
