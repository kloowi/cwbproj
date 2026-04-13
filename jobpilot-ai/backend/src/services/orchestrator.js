const { createProvider, createFallbackProvider } = require("./providerFactory");
const { runAgentPipeline } = require("./semanticKernelOrchestrator");

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
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

module.exports = {
  runAnalysis
};
