const { createProvider, createFallbackProvider } = require("./providerFactory");
const { runAgentPipeline } = require("./semanticKernelOrchestrator");

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRoleTitle(value) {
  const title = String(value || "").trim();
  if (!title) return "";
  return title.slice(0, 120);
}

function normalizeInterview(interview) {
  const questions = Array.isArray(interview?.questions)
    ? interview.questions
      .map((item) => ({
        prompt: String(item?.prompt || "").trim(),
        answer: String(item?.answer || "").trim(),
        focusSkill: String(item?.focusSkill || item?.focus_skill || "").trim()
      }))
      .filter((item) => item.prompt && item.answer)
      .slice(0, 4)
    : [];

  return { questions };
}

function normalizeAnalysisResult(result, providerName) {
  const normalized = result && typeof result === "object" ? { ...result } : {};
  const match = normalized.match && typeof normalized.match === "object" ? { ...normalized.match } : {};
  const missing = normalizeArray(match.missing).length
    ? normalizeArray(match.missing)
    : normalizeArray(match.missing_skills);

  normalized.resume = normalized.resume && typeof normalized.resume === "object"
    ? normalized.resume
    : { skills: [], experience_level: "junior" };
  normalized.job = normalized.job && typeof normalized.job === "object"
    ? normalized.job
    : { skills: [], role_level: "junior" };
  normalized.job.title = normalizeRoleTitle(normalized.job.title);
  normalized.match = {
    score: Number.isFinite(Number(match.score)) ? Number(match.score) : 0,
    missing,
    strengths: normalizeArray(match.strengths),
    reasoning: typeof match.reasoning === "string" ? match.reasoning : ""
  };
  normalized.plan = normalized.plan && typeof normalized.plan === "object"
    ? { 
        roadmap: normalizeArray(normalized.plan.roadmap),
        improvements: normalizeArray(normalized.plan.improvements)
      }
    : { roadmap: [], improvements: [] };
  normalized.interview = normalizeInterview(normalized.interview);
  normalized.meta = {
    provider: normalized.meta?.provider || providerName
  };

  return normalized;
}

async function runAnalysis({ resume, job }) {
  try {
    const provider = createProvider();
    const result = await runAgentPipeline(provider, { resume, job });
    return normalizeAnalysisResult(result, provider.name);
  } catch (error) {
    const fallbackProvider = createFallbackProvider();
    const result = await fallbackProvider.analyze({ resume, job });
    return normalizeAnalysisResult(result, fallbackProvider.name);
  }
}

module.exports = {
  runAnalysis
};
