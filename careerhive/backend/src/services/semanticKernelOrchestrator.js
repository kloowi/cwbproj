// Microsoft Agent Framework orchestration boundary.
// Delegates the staged pipeline (Resume -> Job -> Matching -> Planner -> Interview)
// to a Python sidecar (careerhive/agent-service) running the official
// `agent-framework` package. Falls back to in-process staged execution if the
// sidecar is not configured or unreachable, so local dev works without it.

const AGENT_SERVICE_TIMEOUT_MS = Number(process.env.AGENT_SERVICE_TIMEOUT_MS || 60000);

function agentServiceUrl() {
  return process.env.AGENT_SERVICE_URL || "";
}

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
  const interview = typeof provider.generateInterviewQuestions === "function"
    ? await provider.generateInterviewQuestions({ resume, job, match, plan })
    : { questions: [] };

  return {
    resume,
    job,
    match,
    plan,
    interview,
    meta: {
      provider: provider.name,
      pipeline: "staged"
    }
  };
}

async function callAgentService(input) {
  const baseUrl = agentServiceUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/pipeline`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume: input.resume, job: input.job }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`agent-service ${response.status}: ${detail.slice(0, 200)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function runAgentPipeline(provider, input) {
  if (agentServiceUrl()) {
    try {
      return await callAgentService(input);
    } catch (error) {
      console.warn(
        `Microsoft Agent Framework sidecar unavailable, falling back to in-process pipeline:`,
        error.message
      );
    }
  }

  if (supportsStagedPipeline(provider)) {
    return executeStaged(provider, input);
  }

  return provider.analyze(input);
}

module.exports = {
  runAgentPipeline
};
