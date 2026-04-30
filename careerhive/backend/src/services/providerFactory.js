const { createFallbackProvider } = require("./providers/fallbackProvider");
const { createMafProvider } = require("./providers/mafProvider");

function createProvider() {
  const providerName = (process.env.LLM_PROVIDER || "maf").toLowerCase();

  if (providerName === "maf") {
    return createMafProvider();
  }

  return createFallbackProvider();
}

module.exports = {
  createProvider,
  createFallbackProvider
};
