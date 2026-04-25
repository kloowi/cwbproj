const { createGroqProvider } = require("./providers/groqProvider");
const { createFallbackProvider } = require("./providers/fallbackProvider");

function createProvider() {
  const providerName = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  if (providerName === "groq") {
    return createGroqProvider();
  }

  return createFallbackProvider();
}

module.exports = {
  createProvider,
  createFallbackProvider
};
