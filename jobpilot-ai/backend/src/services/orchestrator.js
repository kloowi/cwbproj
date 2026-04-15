const { createProvider, createFallbackProvider } = require("./providerFactory");
const { runAgentPipeline } = require("./semanticKernelOrchestrator");
const { runInterviewPipeline } = require("./semanticKernelOrchestrator");

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRoleTitle(value) {
  const title = String(value || "").trim();
  if (!title) return "";
  return title.slice(0, 120);
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
    ? { roadmap: normalizeArray(normalized.plan.roadmap) }
    : { roadmap: [] };
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
    console.warn(`Primary provider failed, using fallback.`, error.message);
    const fallbackProvider = createFallbackProvider();
    const result = await fallbackProvider.analyze({ resume, job });
    return normalizeAnalysisResult(result, fallbackProvider.name);
  }
}

function normalizeInterviewResult(result, providerName) {
  const normalized = result && typeof result === "object" ? { ...result } : {};

  normalized.resume = normalized.resume && typeof normalized.resume === "object"
    ? normalized.resume
    : { skills: [], experience_level: "junior" };
  normalized.job = normalized.job && typeof normalized.job === "object"
    ? normalized.job
    : { skills: [], role_level: "junior" };
  normalized.difficulty = ["Basic", "Intermediate", "Advanced"].includes(normalized.difficulty)
    ? normalized.difficulty
    : "Intermediate";
  normalized.questions = Array.isArray(normalized.questions)
    ? normalized.questions.map((q) => ({
        category: String(q.category || "Technical").trim(),
        question: String(q.question || "").trim(),
        answer: String(q.answer || "").trim(),
        tips: Array.isArray(q.tips) ? q.tips.map((t) => String(t).trim()).filter(Boolean) : []
      }))
    : [];
  normalized.tips = Array.isArray(normalized.tips)
    ? normalized.tips.map((t) => String(t).trim()).filter(Boolean)
    : [];
  normalized.meta = {
    provider: normalized.meta?.provider || providerName
  };

  return normalized;
}

async function runInterviewPrep({ resume, job, difficulty }) {
  try {
    const provider = createProvider();
    const result = await runInterviewPipeline(provider, { resume, job, difficulty });
    return normalizeInterviewResult(result, provider.name);
  } catch (error) {
    console.warn(`Primary provider failed, using fallback.`, error.message);
    const fallbackProvider = createFallbackProvider();
    const result = await fallbackProvider.generateQuestions({ resume, job, difficulty });
    const tipsResult = await fallbackProvider.generateTips({ job, difficulty });
    const resumeData = await fallbackProvider.extractResume(resume);
    const jobData = await fallbackProvider.extractJob(job);
    const combined = {
      resume: resumeData,
      job: jobData,
      questions: result.questions || [],
      tips: tipsResult.tips || [],
      difficulty,
      meta: { provider: fallbackProvider.name }
    };
    return normalizeInterviewResult(combined, fallbackProvider.name);
  }
}

module.exports = {
  runAnalysis,
  runInterviewPrep
};
