// Microsoft Agent Framework compatible orchestration boundary.
// Stage order: Resume Agent -> Job Agent -> Matching Agent -> Planner Agent.

function supportsStagedPipeline(provider) {
  return (
    typeof provider?.extractResume === "function" &&
    typeof provider?.extractJob === "function" &&
    typeof provider?.matchSkills === "function" &&
    typeof provider?.planRoadmap === "function"
  );
}

async function executeStaged(provider, input) {
  const resume = await provider.extractResume(input.resume);
  const job = await provider.extractJob(input.job);
  const match = await provider.matchSkills({
    resume,
    job,
    resumeText: input.resume,
    jobText: input.job
  });
  const plan = await provider.planRoadmap({ resume, job, match });

  return {
    resume,
    job,
    match,
    plan,
    meta: {
      provider: provider.name,
      pipeline: "staged"
    }
  };
}

async function runAgentPipeline(provider, input) {
  if (supportsStagedPipeline(provider)) {
    return executeStaged(provider, input);
  }

  return provider.analyze(input);
}

module.exports = {
  runAgentPipeline
};
