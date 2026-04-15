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

function supportsInterviewPipeline(provider) {
  return (
    typeof provider?.extractResume === "function" &&
    typeof provider?.extractJob === "function" &&
    typeof provider?.generateQuestions === "function" &&
    typeof provider?.generateTips === "function"
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

async function executeInterviewPipeline(provider, input) {
  const resumeData = await provider.extractResume(input.resume);
  const jobData = await provider.extractJob(input.job);
  const questionsData = await provider.generateQuestions({
    resume: input.resume,
    job: input.job,
    difficulty: input.difficulty
  });
  const tipsData = await provider.generateTips({
    job: input.job,
    difficulty: input.difficulty
  });

  return {
    resume: resumeData,
    job: jobData,
    questions: questionsData.questions || [],
    tips: tipsData.tips || [],
    difficulty: input.difficulty,
    meta: {
      provider: provider.name,
      pipeline: "interview"
    }
  };
}

async function runAgentPipeline(provider, input) {
  if (supportsStagedPipeline(provider)) {
    return executeStaged(provider, input);
  }

  return provider.analyze(input);
}

async function runInterviewPipeline(provider, input) {
  if (supportsInterviewPipeline(provider)) {
    return executeInterviewPipeline(provider, input);
  }

  return provider.generateQuestions(input);
}

module.exports = {
  runAgentPipeline,
  runInterviewPipeline
};
