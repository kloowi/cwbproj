const OpenAI = require("openai");
const { canonicalizeSkillList } = require("../skillCanonicalizer");

function parseJsonResponse(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model response is not valid JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

function normalizeLevel(value, fallback = "junior") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["junior", "mid", "senior", "lead"].includes(normalized)) return normalized;
  return fallback;
}

function buildResumeAgentPrompt(resume) {
  return [
    "You are Resume Agent.",
    "Extract structured profile data from the resume.",
    "Return strict JSON only with this shape:",
    "{",
    "  \"skills\": string[],",
    "  \"experience_level\": string",
    "}",
    "Rules:",
    "- skills must be lowercase concise tokens and use canonical forms when obvious (e.g., software, ai, cloud, aws, react, node).",
    "- experience_level must be one of: junior, mid, senior, lead.",
    "- no markdown, no extra keys.",
    "Resume:",
    resume
  ].join("\n");
}

function buildJobAgentPrompt(job) {
  return [
    "You are Job Agent.",
    "Extract required capabilities from the job description.",
    "Return strict JSON only with this shape:",
    "{",
    "  \"skills\": string[],",
    "  \"role_level\": string",
    "}",
    "Rules:",
    "- skills must be lowercase concise tokens and use canonical forms when obvious (e.g., software, ai, cloud, aws, react, node).",
    "- role_level must be one of: junior, mid, senior, lead.",
    "- no markdown, no extra keys.",
    "Job Description:",
    job
  ].join("\n");
}

function buildMatchingAgentPrompt(resumeData, jobData) {
  return [
    "You are Matching Agent.",
    "Compare resume and job data and compute a conservative match score.",
    "Return strict JSON only with this shape:",
    "{",
    "  \"missing\": string[],",
    "  \"strengths\": string[],",
    "  \"reasoning\": string",
    "}",
    "Rules:",
    "- missing: required skills not shown in resume.",
    "- strengths: overlapping skills.",
    "- reasoning must be concise and factual.",
    "- no markdown, no extra keys.",
    "Resume Data:",
    JSON.stringify(resumeData),
    "Job Data:",
    JSON.stringify(jobData)
  ].join("\n");
}

function buildPlannerAgentPrompt(context) {
  return [
    "You are Planner Agent.",
    "Generate a focused roadmap based on missing skills.",
    "Return strict JSON only with this shape:",
    "{",
    "  \"roadmap\": string[]",
    "}",
    "Rules:",
    "- 3 to 5 concise actionable steps.",
    "- prioritize high-impact missing skills first.",
    "- no markdown, no extra keys.",
    "Context:",
    JSON.stringify(context)
  ].join("\n");
}

function buildPrompt(resume, job) {
  return [
    "You are Resume Agent, Job Agent, Matching Agent, and Planner Agent combined.",
    "Return strict JSON only with this shape:",
    "{",
    "  \"resume\": { \"skills\": string[], \"experience_level\": string },",
    "  \"job\": { \"skills\": string[], \"role_level\": string },",
    "  \"match\": { \"score\": number, \"missing\": string[], \"strengths\": string[], \"reasoning\": string },",
    "  \"plan\": { \"roadmap\": string[] }",
    "}",
    "Rules:",
    "- Score must be 0 to 100.",
    "- Skills must be lowercase concise tokens.",
    "- No markdown. No comments. No extra keys.",
    "Resume:",
    resume,
    "Job Description:",
    job
  ].join("\n");
}

function createGroqProvider() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing.");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1"
  });

  async function callAgent(prompt) {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You return JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const text = response.choices?.[0]?.message?.content || "{}";
    return parseJsonResponse(text);
  }

  return {
    name: "groq",
    async extractResume(resumeText) {
      const raw = await callAgent(buildResumeAgentPrompt(resumeText));
      return {
        skills: canonicalizeSkillList(normalizeArray(raw.skills)),
        experience_level: normalizeLevel(raw.experience_level)
      };
    },
    async extractJob(jobText) {
      const raw = await callAgent(buildJobAgentPrompt(jobText));
      return {
        skills: canonicalizeSkillList(normalizeArray(raw.skills)),
        role_level: normalizeLevel(raw.role_level)
      };
    },
    async matchSkills({ resume, job }) {
      const resumeSkills = canonicalizeSkillList(normalizeArray(resume?.skills));
      const jobSkills = canonicalizeSkillList(normalizeArray(job?.skills));

      const raw = await callAgent(buildMatchingAgentPrompt(
        { ...resume, skills: resumeSkills },
        { ...job, skills: jobSkills }
      ));
      const llmStrengths = canonicalizeSkillList(normalizeArray(raw.strengths));
      const exactStrengths = resumeSkills.filter((skill) => jobSkills.includes(skill));
      const strengths = [...new Set([
        ...exactStrengths,
        ...llmStrengths.filter((skill) => resumeSkills.includes(skill) && jobSkills.includes(skill))
      ])];

      const missing = jobSkills.filter((skill) => !strengths.includes(skill));

      const overlapScore = jobSkills.length === 0 ? 55 : Math.round((strengths.length / jobSkills.length) * 100);
      return {
        score: overlapScore,
        missing,
        strengths,
        reasoning: String(raw.reasoning || `Matched ${strengths.length} of ${jobSkills.length || 1} required skills.`).trim()
      };
    },
    async planRoadmap({ resume, job, match }) {
      const raw = await callAgent(buildPlannerAgentPrompt({ resume, job, match }));
      return {
        roadmap: Array.isArray(raw.roadmap) ? raw.roadmap.map((step) => String(step).trim()).filter(Boolean).slice(0, 5) : []
      };
    },
    async analyze({ resume, job }) {
      try {
        const resumeData = await this.extractResume(resume);
        const jobData = await this.extractJob(job);
        const matchData = await this.matchSkills({ resume: resumeData, job: jobData, resumeText: resume, jobText: job });
        const planData = await this.planRoadmap({ resume: resumeData, job: jobData, match: matchData });

        return {
          resume: resumeData,
          job: jobData,
          match: matchData,
          plan: planData,
          meta: { provider: "groq" }
        };
      } catch (_err) {
        // Last-resort compatibility fallback: keep old single-shot behavior.
        const parsed = await callAgent(buildPrompt(resume, job));
        parsed.meta = { provider: "groq", fallback: true };
        return parsed;
      }
    }
  };
}

module.exports = {
  createGroqProvider
};
