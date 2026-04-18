const { createGroqProvider } = require("./providers/groqProvider");
const { createOpenAIProvider } = require("./providers/openaiProvider");
const { createFallbackProvider } = require("./providers/fallbackProvider");

function createProvider() {
  const providerName = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  if (providerName === "openai") {
    return createOpenAIProvider();
  }

  if (providerName === "groq") {
    return createGroqProvider();
  }

  return createFallbackProvider();
}

module.exports = {
  createProvider,
  createFallbackProvider
};
