const OpenAI = require("openai");

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

function normalizeInterviewQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      prompt: String(item?.prompt || "").trim(),
      answer: String(item?.answer || "").trim(),
      focusSkill: String(item?.focusSkill || item?.focus_skill || "").trim()
    }))
    .filter((item) => item.prompt && item.answer)
    .slice(0, 4);
}

function buildPrompt(resume, job) {
  return [
    "You are part of a multi-agent job matching backend.",
    "Return strict JSON only with this exact shape:",
    "{",
    "  \"resume\": { \"skills\": string[], \"experience_level\": string },",
    "  \"job\": { \"title\": string, \"skills\": string[], \"role_level\": string },",
    "  \"match\": { \"score\": number, \"missing\": string[], \"strengths\": string[], \"reasoning\": string },",
    "  \"plan\": { \"roadmap\": string[] },",
    "  \"interview\": { \"questions\": [{ \"prompt\": string, \"answer\": string, \"focusSkill\": string }] }",
    "}",
    "Rules:",
    "- Score must be 0 to 100.",
    "- job.title must be the best inferred job title from the posting.",
    "- Skills should be lowercase concise tokens.",
    "- Generate exactly 4 interview questions with AI answers that directly correlate to the target role, strengths, and missing skills.",
    "- No markdown. No extra keys.",
    "Resume:",
    resume,
    "Job Description:",
    job
  ].join("\n");
}

function createOpenAIProvider() {
  return {
    name: "openai",
    async analyze({ resume, job }) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is missing.");
      }

      const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
      const client = new OpenAI({ apiKey });

      const response = await client.responses.create({
        model,
        input: buildPrompt(resume, job),
        max_output_tokens: 900
      });

      const text = response.output_text || "";
      const parsed = parseJsonResponse(text);
      parsed.interview = {
        questions: normalizeInterviewQuestions(parsed?.interview?.questions)
      };
      parsed.meta = { provider: "openai" };
      return parsed;
    }
  };
}

module.exports = {
  createOpenAIProvider
};
