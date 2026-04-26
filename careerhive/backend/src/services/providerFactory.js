const { createGroqProvider } = require("./providers/groqProvider");
const { createFallbackProvider } = require("./providers/fallbackProvider");
const { createMafProvider } = require("./providers/mafProvider");

function createProvider() {
  const providerName = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  if (providerName === "groq") {
    return createGroqProvider();
  }

  if (providerName === "maf") {
    return createMafProvider();
  }

  return createFallbackProvider();
}

module.exports = {
  createProvider,
  createFallbackProvider
};
