import "./styles.css";

const configuredApiBaseUrl = (import.meta.env.VITE_API_URL || "").trim();
const apiBaseUrl = (configuredApiBaseUrl || (window.location.hostname === "localhost" ? "http://localhost:5050" : "")).replace(/\/$/, "");
const SESSION_KEY = "jobpilot_session_id";
const ACTIVE_VIEW_KEY = "jobpilot_active_view";
const ROADMAP_PROGRESS_KEY = "jobpilot_roadmap_progress_v1";
const SAVED_INTERVIEW_ROLES_KEY = "careerhive_saved_interview_roles_v1";
const PIPELINE_STAGE_DURATION_MS = 1100;
const PIPELINE_REVEAL_DELAY_MS = 280;
const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".docx"];
const DEFAULT_INTERVIEW_ROLE_SLUG = "software-eng";
const DEFAULT_INTERVIEW_ROLE_LABEL = "Software Engineer";

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

const INTERVIEW_FALLBACK_QUESTIONS = [
  {
    prompt: "How do you prioritize technical tradeoffs when product timelines are tight?",
    answer: "I frame tradeoffs by user impact, delivery risk, and long-term maintenance cost. I ship the smallest safe increment, document debt explicitly, and schedule hardening work with measurable outcomes."
  },
  {
    prompt: "How do you collaborate across product, design, and engineering during delivery?",
    answer: "I align early on success criteria and constraints, then maintain a fast feedback loop with short demos and decision logs so execution stays focused on user value."
  },
  {
    prompt: "Tell me about a system you improved for reliability or performance.",
    answer: "I start with baseline metrics, isolate the dominant bottleneck, roll out changes incrementally with safeguards, and validate impact after release."
  },
  {
    prompt: "How do you keep your technical knowledge current in your target domain?",
    answer: "I combine focused reading, practical experiments, and project postmortems to turn new trends into reusable decisions and better implementation patterns."
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
        </button>
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
          <div id="dashboard-history" class="dashboard-history-container"></div>
          <div class="interview-prep-pagination" id="dashboard-history-pagination" style="display: none; margin-top: 24px;">
            <button type="button" id="dashboard-history-prev-btn" class="pagination-btn" aria-label="Previous page">&lt;</button>
            <button type="button" id="dashboard-history-next-btn" class="pagination-btn" aria-label="Next page">&gt;</button>
          </div>
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
                <p class="upload-zone-copy">Drop your resume here</p>
                <span class="upload-zone-divider" aria-hidden="true"><strong>or</strong></span>
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
              <p class="input-card-copy">Enter Job URL</p>
              <input
                id="job-url"
                name="jobUrl"
                type="url"
                class="job-url-input"
                placeholder="https://example.com/careers/job-posting"
                autocomplete="off"
              />
              <span class="upload-zone-divider job-or-divider" aria-hidden="true"><strong>or</strong></span>
              <p class="input-card-copy">Enter job title only or full description.</p>
              <textarea id="job" name="job" class="input-zone job-textarea" placeholder="Example: Looking for a UI Designer with 5 years experience in Figma..."></textarea>
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
            <p class="analysis-kicker">CareerHive Interview</p>
            <h2>Start Your Interview Preparation</h2>
            <p>Choose a role to generate a tailored preparation session.</p>
          </div>

          <div class="interview-prep-actions" aria-label="Interview Prep Primary Actions">

            <button type="button" class="interview-prep-action-card interview-prep-browse-card" id="interview-prep-browse-roles-btn" aria-label="Browse predefined roles for interview preparation">
              <span class="interview-prep-action-icon" aria-hidden="true">
                <span class="material-symbols-outlined">travel_explore</span>
              </span>
              <h3>Browse Roles</h3>
              <p>To start, choose from a role and click Prepare.</p>
              <span class="interview-prep-action-cta">Go to Dashboard <span class="material-symbols-outlined" aria-hidden="true">dashboard</span></span>
            </button>
          </div>
          <div class="interview-prep-pagination" id="interview-prep-pagination" style="display: none;">
            <button type="button" id="interview-prep-prev-btn" class="pagination-btn" aria-label="Previous page">&lt;</button>
            <button type="button" id="interview-prep-next-btn" class="pagination-btn" aria-label="Next page">&gt;</button>
          </div>
        </section>
      </section>

      <section class="interview-detail-view view-hidden" id="interview-detail-view" aria-label="Interview Session Detail">
        <section class="panel interview-detail-panel" aria-label="Interview Role Session">
          <button type="button" class="interview-detail-back-btn" id="interview-detail-back-btn">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Back to Interview Prep
          </button>
          <p class="interview-detail-breadcrumb" id="interview-detail-breadcrumb">
            Interview Prep <span class="interview-detail-breadcrumb-sep" aria-hidden="true">&gt;</span> <strong id="interview-detail-role-label">Software Engineer</strong>
          </p>
          <header class="interview-detail-head">
            <h2 id="interview-detail-title">Interview Preparation: Software Engineer</h2>
            <p id="interview-detail-subtitle">Build confidence with role-specific prompts, concise answer structures, and focused practice loops.</p>
          </header>

          <section class="interview-detail-readiness" aria-label="Readiness Overview">
            <div class="interview-detail-stats" id="interview-detail-stats"></div>
          </section>

          <section class="interview-detail-questions card-lite" aria-label="Tailored Questions">
            <div class="interview-detail-questions-head">
              <h3>Tailored Questions</h3>
            </div>
            <div class="interview-question-list" id="interview-question-list"></div>
          </section>
        </section>
      </section>

      <section class="saved-analysis-view view-hidden" id="saved-analysis-view" aria-label="Saved Analysis">
        <section class="panel saved-analysis-panel" aria-label="Saved Analysis Report">
          <button type="button" class="interview-detail-back-btn" id="saved-analysis-back-btn">
            <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            Back to Dashboard
          </button>
          <p class="interview-detail-breadcrumb" id="saved-analysis-breadcrumb">
            Dashboard <span class="interview-detail-breadcrumb-sep" aria-hidden="true">&gt;</span>
            <strong id="saved-analysis-role-label"></strong>
          </p>
          <header class="interview-detail-head saved-analysis-head">
            <h2 id="saved-analysis-title">Analysis Results</h2>
            <p id="saved-analysis-subtitle">Cross-referenced against this role's key requirements to produce clear next actions.</p>
          </header>
          <div id="saved-analysis-content"></div>
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
    </u>
  </div>
`;

const form = document.querySelector("#analyze-form");
const submitBtn = document.querySelector("#submit-btn");
const errorEl = document.querySelector("#error");
const resultsEl = document.querySelector("#results");
const analysisResultsPanelEl = document.querySelector("#analysis-results-panel");
const dashboardStatsEl = document.querySelector("#dashboard-stats");
const dashboardHistoryEl = document.querySelector("#dashboard-history");
const dashboardHistoryPaginationEl = document.querySelector("#dashboard-history-pagination");
const dashboardHistoryPrevBtn = document.querySelector("#dashboard-history-prev-btn");
const dashboardHistoryNextBtn = document.querySelector("#dashboard-history-next-btn");
const dashboardViewEl = document.querySelector("#dashboard-view");
const analysisViewEl = document.querySelector("#analysis-view");
const interviewPrepViewEl = document.querySelector("#interview-prep-view");
const interviewDetailViewEl = document.querySelector("#interview-detail-view");
const navDashboardBtn = document.querySelector("#nav-dashboard");
const navNewAnalysisBtn = document.querySelector("#nav-new-analysis");
const navInterviewPrepBtn = document.querySelector("#nav-interview-prep");
const interviewPrepActionsEl = document.querySelector(".interview-prep-actions");
const interviewPrepBrowseRolesBtn = document.querySelector("#interview-prep-browse-roles-btn");
const interviewPrepPaginationEl = document.querySelector("#interview-prep-pagination");
const interviewPrepPrevBtn = document.querySelector("#interview-prep-prev-btn");
const interviewPrepNextBtn = document.querySelector("#interview-prep-next-btn");
const interviewDetailBackBtn = document.querySelector("#interview-detail-back-btn");
const interviewDetailRoleLabelEl = document.querySelector("#interview-detail-role-label");
const interviewDetailTitleEl = document.querySelector("#interview-detail-title");
const interviewDetailSubtitleEl = document.querySelector("#interview-detail-subtitle");
const interviewDetailStatsEl = document.querySelector("#interview-detail-stats");
const interviewQuestionListEl = document.querySelector("#interview-question-list");
const filterMinScoreEl = document.querySelector("#filter-min-score");
const filterMaxScoreEl = document.querySelector("#filter-max-score");
const filterDateRangeEl = document.querySelector("#filter-date-range");
const dashboardReportOverlayEl = document.querySelector("#dashboard-report-overlay");
const savedReportContentEl = document.querySelector("#saved-report-content");
const closeSavedReportBtn = document.querySelector("#close-saved-report-btn");
const savedAnalysisViewEl = document.querySelector("#saved-analysis-view");
const savedAnalysisBackBtn = document.querySelector("#saved-analysis-back-btn");
const savedAnalysisBreadcrumbRoleLabelEl = document.querySelector("#saved-analysis-role-label");
const savedAnalysisTitleEl = document.querySelector("#saved-analysis-title");
const savedAnalysisContentEl = document.querySelector("#saved-analysis-content");
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
let activeView = "analysis";
let currentInterviewPage = 0;
let currentDashboardPage = 0;
let dashboardHistoryItems = [];
let interviewDetailState = {
  roleId: "",
  roleSlug: DEFAULT_INTERVIEW_ROLE_SLUG,
  roleLabel: DEFAULT_INTERVIEW_ROLE_LABEL,
  roleType: "software",
  activeQuestionIndex: 0,
  questions: [],
  readiness: null,
  analysisHints: null
};
const roadmapProgressState = loadRoadmapProgressState();
let savedInterviewRoles = loadSavedInterviewRoles();

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

function loadSavedInterviewRoles() {
  try {
    const raw = localStorage.getItem(SAVED_INTERVIEW_ROLES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .filter((item) => String(item.roleSlug || "").trim())
      .map((item) => ({
        id: String(item.id || item.roleSlug || "").trim(),
        roleSlug: String(item.roleSlug || "").trim(),
        roleLabel: String(item.roleLabel || "").trim() || roleLabelFromSlug(String(item.roleSlug || "")),
        roleType: String(item.roleType || "").trim() || inferRoleType(String(item.roleLabel || ""), ""),
        score: Number.isFinite(Number(item.score)) ? Math.max(0, Math.min(100, Number(item.score))) : 0,
        readiness: normalizeReadinessSnapshot(item.readiness),
        interviewQuestions: toTrimmedInterviewQuestions(item.interviewQuestions),
        preview: String(item.preview || "").trim(),
        savedAt: Number.isFinite(Number(item.savedAt)) ? Number(item.savedAt) : Date.now()
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch (_error) {
    return [];
  }
}

function persistSavedInterviewRoles() {
  try {
    localStorage.setItem(SAVED_INTERVIEW_ROLES_KEY, JSON.stringify(savedInterviewRoles));
  } catch (_error) {
  }
}

function getSavedRoleIcon(roleType) {
  if (roleType === "frontend") return "code";
  if (roleType === "backend") return "dns";
  return "work";
}

function shortenPreview(text, maxLength = 92) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Role snapshot saved from your latest interview prep session.";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function triggerPageAnimation(el) {
  if (!el) return;
  el.classList.remove("animate-page-change");
  void el.offsetWidth;
  el.classList.add("animate-page-change");
}

function renderSavedInterviewRoleCards() {
  if (!interviewPrepActionsEl) return;
  triggerPageAnimation(interviewPrepActionsEl);

  interviewPrepActionsEl
    .querySelectorAll(".interview-prep-saved-role-card")
    .forEach((card) => card.remove());

  const itemsPerPage = 6;
  const totalItems = savedInterviewRoles.length + 1;
  const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);

  if (currentInterviewPage > maxPage) {
    currentInterviewPage = maxPage;
  }

  if (interviewPrepPaginationEl) {
    interviewPrepPaginationEl.style.display = totalItems > itemsPerPage ? "flex" : "none";
  }
  if (interviewPrepPrevBtn) {
    interviewPrepPrevBtn.disabled = currentInterviewPage === 0;
  }
  if (interviewPrepNextBtn) {
    interviewPrepNextBtn.disabled = currentInterviewPage >= maxPage;
  }

  const startIndex = currentInterviewPage * itemsPerPage;
  const paginatedRoles = savedInterviewRoles.slice(startIndex, startIndex + itemsPerPage);

  const isBrowseCardVisible = (totalItems - 1) >= startIndex && (totalItems - 1) < (startIndex + itemsPerPage);

  if (interviewPrepBrowseRolesBtn) {
    interviewPrepBrowseRolesBtn.style.display = isBrowseCardVisible ? "" : "none";
  }

  if (!paginatedRoles.length) return;

  const cardsMarkup = paginatedRoles
    .map((item) => {
      const score = Math.round(Math.max(0, Math.min(100, Number(item.score) || 0)));
      const icon = getSavedRoleIcon(item.roleType);
      const roleTypeLabel = item.roleType === 'frontend' ? 'Frontend' : item.roleType === 'backend' ? 'Backend' : 'General';
      return `<div class="interview-prep-action-card interview-prep-saved-role-card">
        <div class="ipc-top-row">
          <span class="interview-prep-saved-role-icon" aria-hidden="true">
            <span class="material-symbols-outlined">${icon}</span>
          </span>
          <span class="ipc-score-badge">
            <span class="ipc-score-badge-dot"></span>
            ${score}% match
          </span>
        </div>
        <div class="interview-prep-saved-role-content">
          <h3>${escapeHtml(item.roleLabel)}</h3>
          <span class="ipc-role-chip">
            <span class="material-symbols-outlined" style="font-size: 0.85rem;">badge</span>
            ${roleTypeLabel}
          </span>
        </div>
        <div class="interview-prep-saved-role-footer">
          <button type="button" class="interview-prep-saved-role-delete" data-action="delete-saved-role" data-id="${escapeHtml(item.id)}" aria-label="Delete interview prep for ${escapeHtml(item.roleLabel)}" title="Delete Session">
            <svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v9H7V9Z" />
            </svg>
          </button>
          <button type="button" class="interview-prep-saved-role-continue" data-action="open-saved-role" data-id="${escapeHtml(item.id)}" aria-label="Continue interview prep for ${escapeHtml(item.roleLabel)}" tabindex="-1">
            <span class="material-symbols-outlined" style="font-size: 1rem;">play_circle</span>
            Prepare
          </button>
        </div>
      </div>`;
    })
    .join("");

  interviewPrepActionsEl.insertAdjacentHTML("afterbegin", cardsMarkup);
}

function saveInterviewRoleSnapshot(roleContext, options = {}) {
  if (!roleContext?.roleSlug) return;

  const useSaved = Boolean(options.useSaved);
  const sourceData = useSaved ? latestSavedReportData : latestMainReportData;
  const previewFallback = useSaved ? sourceData?.input?.jobSnippet : form?.job?.value;
  const preview = String(sourceData?.input?.jobSnippet || previewFallback || "").replace(/\s+/g, " ").trim();
  const score = Number(sourceData?.match?.score ?? roleContext?.analysisHints?.matchScore ?? 0);
  const id = roleContext.id || options.analysisId || sourceData?.meta?.analysisId || sourceData?.id || `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const nextItem = {
    id,
    roleSlug: roleContext.roleSlug,
    roleLabel: roleContext.roleLabel || roleLabelFromSlug(roleContext.roleSlug),
    roleType: roleContext.roleType || inferRoleType(roleContext.roleLabel || "", preview),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    readiness: normalizeReadinessSnapshot(roleContext.readiness),
    interviewQuestions: toTrimmedInterviewQuestions(roleContext.analysisHints?.interviewQuestions),
    preview,
    savedAt: Date.now()
  };

  savedInterviewRoles = [
    nextItem,
    ...savedInterviewRoles.filter((item) => item.id !== nextItem.id)
  ];

  persistSavedInterviewRoles();
  renderSavedInterviewRoleCards();
}

function openSavedInterviewRole(id) {
  const target = savedInterviewRoles.find((item) => item.id === id);
  if (!target) return;

  openInterviewDetail({
    id: target.id,
    roleSlug: target.roleSlug,
    roleLabel: target.roleLabel,
    roleType: target.roleType,
    readiness: target.readiness,
    analysisHints: {
      interviewQuestions: toTrimmedInterviewQuestions(target.interviewQuestions)
    }
  });
}

function clampScore(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function toTrimmedArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function toTrimmedInterviewQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      prompt: String(item?.prompt || "").trim(),
      answer: String(item?.answer || "").trim(),
      focusSkill: String(item?.focusSkill || item?.focus_skill || "").trim()
    }))
    .filter((item) => item.prompt && item.answer)
    .slice(0, 4);
}

function normalizeReadinessSnapshot(readiness) {
  if (!readiness || typeof readiness !== "object") return null;

  const technical = clampScore(readiness.technicalReadiness);
  const behavioral = clampScore(readiness.behavioralReadiness);
  const industry = clampScore(readiness.industryKnowledge);

  return {
    technicalReadiness: Math.round(technical),
    behavioralReadiness: Math.round(behavioral),
    industryKnowledge: Math.round(industry)
  };
}

function extractInterviewSignals(roleContext, options = {}) {
  if (roleContext?.analysisHints && typeof roleContext.analysisHints === "object") {
    return {
      roleLabel: roleContext.roleLabel || DEFAULT_INTERVIEW_ROLE_LABEL,
      roleType: roleContext.roleType || "software",
      matchScore: clampScore(roleContext.analysisHints.matchScore),
      missingSkills: toTrimmedArray(roleContext.analysisHints.missingSkills),
      strengths: toTrimmedArray(roleContext.analysisHints.strengths),
      roadmap: toTrimmedArray(roleContext.analysisHints.roadmap),
      reasoning: String(roleContext.analysisHints.reasoning || ""),
      resumeSnippet: String(roleContext.analysisHints.resumeSnippet || ""),
      jobSnippet: String(roleContext.analysisHints.jobSnippet || ""),
      interviewQuestions: toTrimmedInterviewQuestions(roleContext.analysisHints.interviewQuestions)
    };
  }

  const useSaved = Boolean(options.useSaved);
  const sourceData = useSaved ? latestSavedReportData : latestMainReportData;

  return {
    roleLabel: roleContext?.roleLabel || sourceData?.job?.title || DEFAULT_INTERVIEW_ROLE_LABEL,
    roleType: roleContext?.roleType || inferRoleType(sourceData?.job?.title || "", sourceData?.input?.jobSnippet || ""),
    matchScore: clampScore(sourceData?.match?.score),
    missingSkills: toTrimmedArray(sourceData?.match?.missing),
    strengths: toTrimmedArray(sourceData?.match?.strengths),
    roadmap: toTrimmedArray(sourceData?.plan?.roadmap),
    reasoning: String(sourceData?.match?.reasoning || ""),
    resumeSnippet: String(sourceData?.input?.resumeSnippet || ""),
    jobSnippet: String(sourceData?.input?.jobSnippet || ""),
    interviewQuestions: toTrimmedInterviewQuestions(sourceData?.interview?.questions)
  };
}

function scoreKeywordPresence(text, patterns) {
  const corpus = String(text || "").toLowerCase();
  if (!corpus) return 0;
  let matches = 0;
  patterns.forEach((pattern) => {
    if (pattern.test(corpus)) matches += 1;
  });
  return matches;
}

function deriveReadinessFromSignals(signals) {
  const matchScore = clampScore(signals.matchScore);
  const missingCount = signals.missingSkills.length;
  const strengthsCount = signals.strengths.length;
  const totalSkillEvidence = strengthsCount + missingCount;
  const overlapRatio = totalSkillEvidence > 0 ? strengthsCount / totalSkillEvidence : matchScore / 100;
  const missingPressure = clampScore(missingCount * 13);
  const technical = Math.round(clampScore((matchScore * 0.58) + (overlapRatio * 100 * 0.24) + ((100 - missingPressure) * 0.18), 35, 98));

  const behavioralText = `${signals.resumeSnippet} ${signals.reasoning} ${signals.strengths.join(" ")} ${signals.roadmap.join(" ")}`;
  const behavioralSignal = scoreKeywordPresence(behavioralText, [
    /collaborat(e|ion)/g,
    /mentor|coaching/g,
    /stakeholder|cross-functional/g,
    /communication|present|influence/g,
    /ownership|initiative|leadership/g,
    /conflict|feedback|align/g
  ]);
  const behavioral = Math.round(clampScore(40 + (matchScore * 0.34) + (behavioralSignal * 4.5) + (Math.min(signals.roadmap.length, 5) * 1.8) - (missingCount * 1.5), 30, 97));

  const domainText = `${signals.roleLabel} ${signals.jobSnippet} ${signals.reasoning} ${signals.strengths.join(" ")} ${signals.roadmap.join(" ")}`;
  const industrySignal = scoreKeywordPresence(domainText, [
    /regulation|compliance|soc2|hipaa|gdpr|pci/g,
    /market|customer|business|kpi|revenue/g,
    /domain|industry|workflow|operations/g,
    /security|privacy|risk|audit/g,
    /ai|ml|cloud|distributed|platform|infra/g,
    /fintech|healthcare|ecommerce|saas|logistics|education/g
  ]);
  const roleSpecificBonus = /manager|lead|principal|staff|director/i.test(signals.roleLabel) ? 4 : 0;
  const industry = Math.round(clampScore(38 + (matchScore * 0.36) + (industrySignal * 4.2) + roleSpecificBonus - (missingCount * 1.2), 30, 98));

  return {
    technicalReadiness: technical,
    behavioralReadiness: behavioral,
    industryKnowledge: industry
  };
}

function inferIndustryFocus(signals) {
  const corpus = `${signals.roleLabel} ${signals.jobSnippet}`.toLowerCase();
  if (/fintech|bank|payments|finance/.test(corpus)) return "risk controls, compliance, and reliability in financial systems";
  if (/health|clinical|medical|hospital|biotech/.test(corpus)) return "privacy, safety, and reliability expectations in healthcare products";
  if (/ecommerce|retail|marketplace/.test(corpus)) return "conversion, growth loops, and operational efficiency for digital commerce";
  if (/data|analytics|bi|warehouse/.test(corpus)) return "data quality, governance, and decision-making impact";
  if (/security|cyber|identity/.test(corpus)) return "threat modeling, security controls, and incident response discipline";
  return "how your target industry measures product and technical impact";
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

function normalizeRoleLabel(value) {
  const cleaned = String(value || "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return DEFAULT_INTERVIEW_ROLE_LABEL;
  return cleaned
    .split(" ")
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "ui") return "UI";
      if (lower === "ux") return "UX";
      if (lower === "qa") return "QA";
      if (lower === "ml") return "ML";
      if (lower === "ai") return "AI";
      if (lower === "devops") return "DevOps";
      if (lower === "sre") return "SRE";
      if (lower === "fe") return "Frontend";
      if (lower === "be") return "Backend";
      if (lower === "eng") return "Engineer";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function toRoleSlug(value) {
  const lower = String(value || "").toLowerCase();
  if (!lower.trim()) return DEFAULT_INTERVIEW_ROLE_SLUG;

  if (/(software)\s+(engineer|eng|developer)/.test(lower)) return "software-eng";
  if (/(frontend|front-end|front end)\s+(engineer|eng|developer)/.test(lower)) return "frontend-eng";
  if (/(backend|back-end|back end)\s+(engineer|eng|developer)/.test(lower)) return "backend-eng";

  const collapsed = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\b(engineer|engineering)\b/g, "eng")
    .replace(/\bdeveloper\b/g, "dev")
    .replace(/\s+/g, " ")
    .trim();

  if (!collapsed) return DEFAULT_INTERVIEW_ROLE_SLUG;
  return collapsed.split(" ").slice(0, 4).join("-");
}

function roleLabelFromSlug(slug) {
  if (!slug) return DEFAULT_INTERVIEW_ROLE_LABEL;
  if (slug === "software-eng") return "Software Engineer";
  if (slug === "frontend-eng") return "Frontend Engineer";
  if (slug === "backend-eng") return "Backend Engineer";
  return normalizeRoleLabel(slug.replace(/-/g, " "));
}

function inferRoleType(roleLabel, contextText = "") {
  const corpus = `${String(roleLabel || "")} ${String(contextText || "")}`.toLowerCase();
  if (/frontend|front-end|react|vue|angular|typescript|javascript|ui|ux/.test(corpus)) {
    return "frontend";
  }
  if (/backend|back-end|node|java|spring|api|database|postgres|distributed|microservice/.test(corpus)) {
    return "backend";
  }
  return "software";
}

function parseInterviewRoute(pathnameValue = window.location.pathname) {
  const pathname = String(pathnameValue || "").trim();
  const match = pathname.match(/^\/interview-prep\/([^/]+)$/);
  if (!match) return null;

  const encoded = match[1].trim();
  if (!encoded) return DEFAULT_INTERVIEW_ROLE_SLUG;

  try {
    const decoded = decodeURIComponent(encoded).toLowerCase();
    const sanitized = decoded.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return sanitized || DEFAULT_INTERVIEW_ROLE_SLUG;
  } catch (_error) {
    return DEFAULT_INTERVIEW_ROLE_SLUG;
  }
}

function parseTopLevelRoute(pathnameValue = window.location.pathname) {
  const pathname = String(pathnameValue || "").replace(/\/+$/, "") || "/";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/analysis" || pathname === "/") return "analysis";
  if (pathname === "/interview-prep") return "interview-prep";
  return null;
}

function setPathForView(view, options = {}) {
  const route = view === "dashboard"
    ? "dashboard"
    : view === "interview-prep"
      ? "interview-prep"
      : "analysis";
  const nextPath = `/${route}`;
  const nextUrl = `${nextPath}${window.location.search}`;

  if (window.location.pathname === nextPath) {
    setActiveView(route);
    return;
  }

  if (options.replace) {
    window.history.replaceState(null, "", nextUrl);
    setActiveView(route);
    return;
  }

  window.history.pushState(null, "", nextUrl);
  setActiveView(route);
}

function buildInterviewRouteHash(id) {
  return `/interview-prep/${encodeURIComponent(id || DEFAULT_INTERVIEW_ROLE_SLUG)}`;
}

function parseAnalysisRoute(pathnameValue = window.location.pathname) {
  const pathname = String(pathnameValue || "").trim();
  const match = pathname.match(/^\/analysis\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim()) || null;
  } catch (_) {
    return null;
  }
}

function buildAnalysisRoutePath(id) {
  return `/analysis/${encodeURIComponent(id)}`;
}

function inferRoleLabelFromInputText(inputText) {
  const normalized = String(inputText || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const splitCandidate = normalized.split(/[\.|\n\-:|]/)[0].trim();
  if (!splitCandidate) return "";

  if (/software engineer|software developer/i.test(splitCandidate)) return "Software Engineer";
  if (/frontend engineer|frontend developer|react/i.test(splitCandidate)) return "Frontend Engineer";
  if (/backend engineer|backend developer/i.test(splitCandidate)) return "Backend Engineer";

  return normalizeRoleLabel(splitCandidate.split(" ").slice(0, 5).join(" "));
}

function deriveInterviewRoleContext(options = {}) {
  const useSaved = Boolean(options.useSaved);
  const sourceData = useSaved ? latestSavedReportData : latestMainReportData;
  const sourceOptions = useSaved ? latestSavedReportOptions : latestMainReportOptions;
  const candidates = [
    sourceData?.job?.title,
    sourceOptions?.title,
    inferRoleLabelFromInputText(sourceData?.input?.jobSnippet),
    inferRoleLabelFromInputText(form?.job?.value)
  ];

  const roleLabel = normalizeRoleLabel(candidates.find((item) => String(item || "").trim()) || DEFAULT_INTERVIEW_ROLE_LABEL);
  const roleSlug = toRoleSlug(roleLabel);
  const roleType = inferRoleType(roleLabel, `${sourceData?.input?.jobSnippet || ""} ${sourceData?.match?.missing?.join(" ") || ""}`);
  const id = options.analysisId || sourceData?.meta?.analysisId || sourceData?.id || `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const analysisHints = extractInterviewSignals({ roleLabel, roleType }, options);
  const readiness = normalizeReadinessSnapshot(deriveReadinessFromSignals(analysisHints));

  return {
    id,
    roleLabel,
    roleSlug,
    roleType,
    readiness,
    analysisHints
  };
}

function getInterviewReadinessStats(roleContext, options = {}) {
  const snapshot = normalizeReadinessSnapshot(roleContext?.readiness);
  const derived = snapshot || normalizeReadinessSnapshot(deriveReadinessFromSignals(extractInterviewSignals(roleContext, options)));

  return [
    { label: "Technical Readiness", score: derived.technicalReadiness, tone: "is-blue", icon: "code_blocks" },
    { label: "Behavioral Readiness", score: derived.behavioralReadiness, tone: "is-green", icon: "groups" },
    { label: "Industry Knowledge", score: derived.industryKnowledge, tone: "is-indigo", icon: "book_4" }
  ];
}

function buildRoleQuestions(roleContext, options = {}) {
  const signals = extractInterviewSignals(roleContext, options);
  if (signals.interviewQuestions.length) {
    return signals.interviewQuestions.map((item) => ({ ...item }));
  }

  const roleLabel = roleContext?.roleLabel || signals.roleLabel || DEFAULT_INTERVIEW_ROLE_LABEL;
  const topGap = signals.missingSkills[0] || "a critical requirement from the job description";
  const secondGap = signals.missingSkills[1] || topGap;
  const topStrength = signals.strengths[0] || "a high-impact project from your recent work";
  const roadmapFocus = signals.roadmap[0] || `the highest-priority gap for the ${roleLabel} role`;
  const industryFocus = inferIndustryFocus(signals);

  if (!signals.missingSkills.length && !signals.strengths.length && !signals.jobSnippet) {
    return INTERVIEW_FALLBACK_QUESTIONS.map((item) => ({ ...item }));
  }

  return [
    {
      prompt: `For this ${roleLabel} role, how would you close a gap in ${topGap} within your first 60 days?`,
      answer: `I would start with a focused learning sprint on ${topGap}, then apply it in a scoped deliverable tied to team priorities. I would define measurable outcomes and share progress in weekly check-ins so the ramp-up is visible and accountable.`
    },
    {
      prompt: `Walk me through a project where your strength in ${topStrength} changed the outcome.`,
      answer: "I would structure the story with context, constraints, actions, and measurable impact. I would highlight the technical decisions, tradeoffs considered, and what I would improve in a second iteration."
    },
    {
      prompt: `How do you handle feedback when interviewers point out a potential weakness in ${secondGap}?`,
      answer: `I acknowledge the gap directly, explain the plan I am already executing to improve it, and provide evidence from recent practice or deliverables. This shows coachability, ownership, and ability to convert feedback into execution.`
    },
    {
      prompt: `What industry trends matter most for this role, and how would they influence your decisions around ${roadmapFocus}?`,
      answer: `I would connect decisions to ${industryFocus}, then explain how that context changes architecture, prioritization, and risk management. The goal is to show domain awareness and practical decision quality, not only tool knowledge.`
    }
  ];
}

function renderInterviewDetailQuestions() {
  if (!interviewQuestionListEl) return;

  interviewQuestionListEl.innerHTML = interviewDetailState.questions
    .map((question, index) => {
      const isOpen = index === interviewDetailState.activeQuestionIndex;
      return `<article class="interview-question-item ${isOpen ? "is-open" : ""}">
        <button class="interview-question-trigger" type="button" data-interview-question-index="${index}" aria-expanded="${isOpen ? "true" : "false"}">
          <span class="interview-question-trigger-icon material-symbols-outlined" aria-hidden="true">chat</span>
          <span class="interview-question-trigger-text">${escapeHtml(question.prompt)}</span>
          <span class="interview-question-trigger-caret material-symbols-outlined" aria-hidden="true">${isOpen ? "expand_less" : "expand_more"}</span>
        </button>
        <div class="interview-question-answer ${isOpen ? "" : "is-hidden"}">
          <p class="interview-question-answer-label">AI Suggested Answer</p>
          <p>${escapeHtml(question.answer)}</p>
        </div>
      </article>`;
    })
    .join("");
}

function renderInterviewDetail(roleContext, options = {}) {
  const roleId = String(roleContext?.id || roleContext?.roleSlug || "").trim();
  const roleSlug = roleContext?.roleSlug || DEFAULT_INTERVIEW_ROLE_SLUG;
  const roleLabel = roleContext?.roleLabel || DEFAULT_INTERVIEW_ROLE_LABEL;
  const roleType = roleContext?.roleType || "software";
  const shouldRefreshQuestions = roleId !== interviewDetailState.roleId
    || roleSlug !== interviewDetailState.roleSlug
    || !interviewDetailState.questions.length;

  if (shouldRefreshQuestions) {
    interviewDetailState.questions = buildRoleQuestions(roleContext, options);
    interviewDetailState.activeQuestionIndex = 0;
  }

  interviewDetailState.roleId = roleId;
  interviewDetailState.roleSlug = roleSlug;
  interviewDetailState.roleLabel = roleLabel;
  interviewDetailState.roleType = roleType;
  interviewDetailState.readiness = normalizeReadinessSnapshot(roleContext?.readiness);
  interviewDetailState.analysisHints = roleContext?.analysisHints || null;

  interviewDetailRoleLabelEl.textContent = roleLabel;
  interviewDetailTitleEl.textContent = `Interview Preparation: ${roleLabel}`;
  interviewDetailSubtitleEl.textContent = `Practice targeted questions for ${roleLabel} and sharpen structured responses.`;

  const stats = getInterviewReadinessStats(roleContext, options);
  interviewDetailStatsEl.innerHTML = stats
    .map(
      (stat) => `<article class="interview-detail-stat-card">
        <div class="interview-detail-stat-top">
          <span class="interview-detail-stat-icon ${stat.tone}">
            <span class="material-symbols-outlined" aria-hidden="true">${stat.icon}</span>
          </span>
          <strong>${stat.score}%</strong>
        </div>
        <p>${escapeHtml(stat.label)}</p>
        <div class="interview-detail-stat-meter"><span style="width:${stat.score}%"></span></div>
      </article>`
    )
    .join("");

  renderInterviewDetailQuestions();
}

function setInterviewQuestionOpen(index) {
  if (!Number.isInteger(index)) return;
  if (index < 0 || index >= interviewDetailState.questions.length) return;
  interviewDetailState.activeQuestionIndex = index;
  renderInterviewDetailQuestions();
}

function openInterviewDetail(roleContext, options = {}) {
  const context = roleContext || deriveInterviewRoleContext();
  renderInterviewDetail(context, options);

  const targetPath = buildInterviewRouteHash(context.id || context.roleSlug);
  if (window.location.pathname !== targetPath) {
    const nextUrl = `${targetPath}${window.location.search}`;
    window.history.pushState(null, "", nextUrl);
    setActiveView("interview-detail");
    return;
  }

  setActiveView("interview-detail");
}

function syncViewToCurrentRoute() {
  const topLevelRoute = parseTopLevelRoute(window.location.pathname);
  if (topLevelRoute) {
    setActiveView(topLevelRoute);
    return true;
  }

  const analysisId = parseAnalysisRoute(window.location.pathname);
  if (analysisId) {
    openSavedAnalysis(analysisId);
    return true;
  }

  const roleId = parseInterviewRoute(window.location.pathname);
  if (!roleId) return false;

  const savedRole = savedInterviewRoles.find(r => r.id === roleId);
  if (savedRole) {
    renderInterviewDetail({
      id: savedRole.id,
      roleSlug: savedRole.roleSlug,
      roleLabel: savedRole.roleLabel,
      roleType: savedRole.roleType,
      analysisHints: {
        interviewQuestions: toTrimmedInterviewQuestions(savedRole.interviewQuestions)
      }
    });
  } else {
    const legacyRole = savedInterviewRoles.find(r => r.roleSlug === roleId);
    if (legacyRole) {
      renderInterviewDetail({
        id: legacyRole.id,
        roleSlug: legacyRole.roleSlug,
        roleLabel: legacyRole.roleLabel,
        roleType: legacyRole.roleType,
        analysisHints: {
          interviewQuestions: toTrimmedInterviewQuestions(legacyRole.interviewQuestions)
        }
      });
    } else {
      const roleLabel = roleLabelFromSlug(roleId);
      const roleType = inferRoleType(roleLabel, "");
      renderInterviewDetail({ id: roleId, roleSlug: roleId, roleLabel, roleType });
    }
  }

  setActiveView("interview-detail");
  return true;
}

function setActiveView(view) {
  const normalizedView = view === "dashboard"
    ? "dashboard"
    : view === "interview-detail"
      ? "interview-detail"
      : view === "interview-prep"
        ? "interview-prep"
        : view === "saved-analysis"
          ? "saved-analysis"
          : "analysis";

  activeView = normalizedView;

  const showDashboard = normalizedView === "dashboard";
  const showInterviewPrep = normalizedView === "interview-prep";
  const showInterviewDetail = normalizedView === "interview-detail";
  const showSavedAnalysis = normalizedView === "saved-analysis";
  dashboardViewEl.classList.toggle("view-hidden", !showDashboard);
  analysisViewEl.classList.toggle("view-hidden", showDashboard || showInterviewPrep || showInterviewDetail || showSavedAnalysis);
  interviewPrepViewEl.classList.toggle("view-hidden", !showInterviewPrep);
  interviewDetailViewEl.classList.toggle("view-hidden", !showInterviewDetail);
  savedAnalysisViewEl.classList.toggle("view-hidden", !showSavedAnalysis);
  navDashboardBtn.classList.toggle("nav-active", showDashboard || showSavedAnalysis);
  navNewAnalysisBtn.classList.toggle("nav-active", !showDashboard && !showInterviewPrep && !showInterviewDetail && !showSavedAnalysis);
  navInterviewPrepBtn.classList.toggle("nav-active", showInterviewPrep || showInterviewDetail);

  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, showInterviewDetail ? "interview-prep" : showSavedAnalysis ? "dashboard" : normalizedView);
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
      roadmap: Array.isArray(item?.roadmap) ? item.roadmap : [],
      improvements: Array.isArray(item?.improvements) ? item.improvements : []
    },
    interview: {
      questions: toTrimmedInterviewQuestions(item?.interviewQuestions)
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

function buildActionableItems(missingSkills, improvements) {
  const fromImprovements = (improvements || [])
    .map((item) => toSentenceCase(String(item || "")))
    .filter(Boolean)
    .slice(0, 3);

  if (fromImprovements.length) return fromImprovements;

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
  const improvements = (data.plan?.improvements || []).map((item) => String(item || ""));
  const roadmapItems = (data.plan?.roadmap || []).map((item) => String(item || ""));
  const reasoning = escapeHtml(toSentenceCase(data.match?.reasoning || ""));
  const actionItems = buildActionableItems(missingSkills, improvements);
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

function renderSavedAnalysisPage(data) {
  latestSavedReportData = data;
  latestSavedReportOptions = {
    title: data.job?.title || "Role Analysis",
    kicker: "Saved Snapshot",
    includeInputPreview: true,
    resumeSnippet: data.input?.resumeSnippet,
    jobSnippet: data.input?.jobSnippet,
    analysisId: data.meta?.analysisId || ""
  };

  const jobTitle = data.job?.title || "Role Analysis";
  savedAnalysisBreadcrumbRoleLabelEl.textContent = jobTitle.toUpperCase();
  savedAnalysisTitleEl.textContent = `Analysis Results: ${jobTitle}`;

  savedAnalysisContentEl.innerHTML = renderAnalysisReport(data, {
    ...latestSavedReportOptions
  });
}

function renderDashboard(items) {
  if (!items.length) {
    dashboardStatsEl.innerHTML = `
      <article class="stat-card card-lite">
        <div class="stat-head">
          <p class="stat-label">Applications Sent</p>
        </div>
        <p class="stat-value">0</p>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">send</span>
        </div>
      </article>
      <article class="stat-card card-lite">
        <div>
          <div class="stat-head">
            <p class="stat-label">Average Match Score</p>
          </div>
          <p class="stat-value">0%</p>
        </div>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">analytics</span>
        </div>
      </article>
      <article class="stat-card card-lite">
        <div>
          <div class="stat-head">
            <p class="stat-label">Best Match Score</p>
          </div>
          <p class="stat-value">0%</p>
        </div>
        <div class="stat-icon-badge" aria-hidden="true">
          <span class="material-symbols-outlined stat-icon-symbol">verified</span>
        </div>
      </article>
    `;
    dashboardHistoryEl.innerHTML = hasActiveHistoryFilters()
      ? "<p class=\"empty\">No analyses match the current filters.</p>"
      : "<p class=\"empty\">No saved analyses are available yet.</p>";
    if (dashboardHistoryPaginationEl) dashboardHistoryPaginationEl.style.display = "none";
    return;
  }

  const scoreValues = items.map((item) => Number(item.matchScore || 0)).filter((value) => Number.isFinite(value));
  const totalApplications = items.length;
  const avgScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) : 0;
  const topScore = scoreValues.length ? Math.max(...scoreValues) : 0;

  dashboardStatsEl.innerHTML = `
    <article class="stat-card card-lite">
      <div class="stat-head">
        <p class="stat-label">Applications Sent</p>
      </div>
      <p class="stat-value">${totalApplications}</p>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">send</span>
      </div>
    </article>
    <article class="stat-card card-lite">
      <div>
        <div class="stat-head">
          <p class="stat-label">Average Match Score</p>
        </div>
        <p class="stat-value">${avgScore}%</p>
      </div>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">analytics</span>
      </div>
    </article>
    <article class="stat-card card-lite">
      <div>
        <div class="stat-head">
          <p class="stat-label">Best Match Score</p>
        </div>
        <p class="stat-value">${topScore}%</p>
      </div>
      <div class="stat-icon-badge" aria-hidden="true">
        <span class="material-symbols-outlined stat-icon-symbol">verified</span>
      </div>
    </article>
  `;

  dashboardHistoryItems = items;
  currentDashboardPage = 0;
  renderDashboardHistory();
}

function renderDashboardHistory() {
  triggerPageAnimation(dashboardHistoryEl);
  const itemsPerPage = 5;
  const totalItems = dashboardHistoryItems.length;
  const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);

  if (currentDashboardPage > maxPage) {
    currentDashboardPage = maxPage;
  }

  if (dashboardHistoryPaginationEl) {
    dashboardHistoryPaginationEl.style.display = totalItems > itemsPerPage ? "flex" : "none";
  }
  if (dashboardHistoryPrevBtn) {
    dashboardHistoryPrevBtn.disabled = currentDashboardPage === 0;
  }
  if (dashboardHistoryNextBtn) {
    dashboardHistoryNextBtn.disabled = currentDashboardPage >= maxPage;
  }

  const startIndex = currentDashboardPage * itemsPerPage;
  const paginatedItems = dashboardHistoryItems.slice(startIndex, startIndex + itemsPerPage);

  dashboardHistoryEl.innerHTML = `<div class="history-grid">${paginatedItems.map((item) => {
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
          <span class="history-open-label"></span>
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
  const jobUrl = document.getElementById("job-url")?.value.trim() ?? "";
  const hasJob = Boolean(jobUrl || form.job.value.trim());
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

    const targetPath = buildAnalysisRoutePath(id);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", `${targetPath}${window.location.search}`);
    }
    setActiveView("saved-analysis");

    savedAnalysisContentEl.innerHTML = `
      <div class="loading-card card-lite">
        <div class="spinner" aria-hidden="true"></div>
        <div>
          <strong>Loading saved report...</strong>
          <p class="subtle">Retrieving analysis details from your history.</p>
        </div>
      </div>
    `;

    const sessionId = getSessionId();
    const response = await fetch(`${apiBaseUrl}/history/${encodeURIComponent(id)}?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = payload.detail || payload.message || payload.error;
      throw new Error(detail ? `Unable to load saved report: ${detail}` : "Unable to load saved report.");
    }

    const payload = await response.json();
    const data = mapStoredAnalysisToResult(payload.item || {});
    renderSavedAnalysisPage(data);
  } catch (error) {
    errorEl.textContent = formatRequestError(error);
    savedAnalysisContentEl.innerHTML = "";
    setPathForView("dashboard");
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
  const jobUrl = document.getElementById("job-url").value.trim();
  const jobText = form.job.value.trim();

  if (!apiBaseUrl) {
    errorEl.textContent = "API configuration is missing. Set VITE_API_URL to your backend URL and redeploy the frontend.";
    return;
  }

  if (!resumeFile || (!jobUrl && !jobText)) {
    errorEl.textContent = "Please upload a resume file and provide a job URL or description.";
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

    let job = jobText;

    if (jobUrl) {
      submitBtn.textContent = "Fetching Job Posting...";
      const scrapeResponse = await fetch(`${apiBaseUrl}/analyze/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl })
      });
      if (!scrapeResponse.ok) {
        const payload = await scrapeResponse.json().catch(() => ({}));
        const detail = payload.error || payload.message;
        throw new Error(detail ? `Job URL fetch failed: ${detail}` : `Job URL fetch failed (${scrapeResponse.status}).`);
      }
      const scraped = await scrapeResponse.json();
      job = String(scraped?.text || "").trim();
      if (!job) throw new Error("The job URL returned no readable text. Please paste the description manually.");
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
  setPathForView("dashboard");
});

navNewAnalysisBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setPathForView("analysis");
});

navInterviewPrepBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setPathForView("interview-prep");
});


interviewPrepBrowseRolesBtn.addEventListener("click", () => {
  hideSavedAnalysisOverlay();
  setPathForView("dashboard");
});

if (interviewPrepPrevBtn) {
  interviewPrepPrevBtn.addEventListener("click", () => {
    if (currentInterviewPage > 0) {
      currentInterviewPage -= 1;
      renderSavedInterviewRoleCards();
    }
  });
}

if (interviewPrepNextBtn) {
  interviewPrepNextBtn.addEventListener("click", () => {
    const itemsPerPage = 6;
    const totalItems = savedInterviewRoles.length + 1;
    const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);
    if (currentInterviewPage < maxPage) {
      currentInterviewPage += 1;
      renderSavedInterviewRoleCards();
    }
  });
}

if (dashboardHistoryPrevBtn) {
  dashboardHistoryPrevBtn.addEventListener("click", () => {
    if (currentDashboardPage > 0) {
      currentDashboardPage -= 1;
      renderDashboardHistory();
    }
  });
}

if (dashboardHistoryNextBtn) {
  dashboardHistoryNextBtn.addEventListener("click", () => {
    const itemsPerPage = 5;
    const totalItems = dashboardHistoryItems.length;
    const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);
    if (currentDashboardPage < maxPage) {
      currentDashboardPage += 1;
      renderDashboardHistory();
    }
  });
}

interviewPrepActionsEl.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest("[data-action='delete-saved-role']");
  if (deleteBtn) {
    event.preventDefault();
    event.stopPropagation();
    const roleId = String(deleteBtn.getAttribute("data-id") || "").trim();
    if (!roleId) return;

    if (!confirm("Are you sure you want to delete this interview preparation? This action cannot be undone.")) {
      return;
    }

    savedInterviewRoles = savedInterviewRoles.filter((item) => item.id !== roleId);
    persistSavedInterviewRoles();

    const itemsPerPage = 6;
    const totalItems = savedInterviewRoles.length + 1;
    const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);
    if (currentInterviewPage > maxPage) {
      currentInterviewPage = maxPage;
    }

    renderSavedInterviewRoleCards();
    return;
  }

  const savedRoleButton = event.target.closest("[data-action='open-saved-role']");
  if (!savedRoleButton) return;

  event.preventDefault();
  const roleId = String(savedRoleButton.getAttribute("data-id") || savedRoleButton.getAttribute("data-role-slug") || "").trim();
  if (!roleId) return;
  openSavedInterviewRole(roleId);
});

interviewDetailBackBtn.addEventListener("click", () => {
  setPathForView("interview-prep");
});

savedAnalysisBackBtn.addEventListener("click", () => {
  setPathForView("dashboard");
  loadHistory();
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

document.getElementById("job-url").addEventListener("input", () => {
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
  if (handleRoadmapInteraction(event)) return;

  const nextStepBtn = event.target.closest(".next-step-cta");
  if (!nextStepBtn) return;

  event.preventDefault();
  hideSavedAnalysisOverlay();
  const roleContext = deriveInterviewRoleContext();
  saveInterviewRoleSnapshot(roleContext, { useSaved: false });
  openInterviewDetail(roleContext);
});

savedReportContentEl.addEventListener("click", (event) => {
  if (handleRoadmapInteraction(event)) return;

  const nextStepBtn = event.target.closest(".next-step-cta");
  if (!nextStepBtn) return;

  event.preventDefault();
  const roleContext = deriveInterviewRoleContext({ useSaved: true });
  saveInterviewRoleSnapshot(roleContext, { useSaved: true });
  openInterviewDetail(roleContext);
});

interviewQuestionListEl.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-interview-question-index]");
  if (!trigger) return;

  const index = Number(trigger.getAttribute("data-interview-question-index"));
  if (!Number.isInteger(index)) return;
  setInterviewQuestionOpen(index);
});

window.addEventListener("popstate", () => {
  const isInterviewRoute = syncViewToCurrentRoute();
  if (isInterviewRoute) return;

  if (activeView === "interview-detail") {
    setActiveView("interview-prep");
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
if (!syncViewToCurrentRoute()) {
  const initialView = getInitialView();
  setActiveView(initialView);
  setPathForView(initialView, { replace: true });
}
renderSavedInterviewRoleCards();
loadHistory();
setResumeFileStatus("No file selected", "is-idle");
updateSubmitAvailability();
