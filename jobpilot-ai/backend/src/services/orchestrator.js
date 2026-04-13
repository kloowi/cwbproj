const { createProvider, createFallbackProvider } = require("./providerFactory");
const { runAgentPipeline } = require("./semanticKernelOrchestrator");

async function runAnalysis({ resume, job }) {
  const provider = createProvider();

  try {
    return await runAgentPipeline(provider, { resume, job });
  } catch (error) {
    console.warn(`Provider ${provider.name} failed, using fallback.`, error.message);
    const fallbackProvider = createFallbackProvider();
    return fallbackProvider.analyze({ resume, job });
  }
}

module.exports = {
  runAnalysis
};
