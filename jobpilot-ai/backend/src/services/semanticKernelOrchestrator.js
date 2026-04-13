// Microsoft Agent Framework compatible orchestration boundary.
// Replace internals with official Semantic Kernel SDK wiring when desired.
async function runAgentPipeline(provider, input) {
  return provider.analyze(input);
}

module.exports = {
  runAgentPipeline
};
