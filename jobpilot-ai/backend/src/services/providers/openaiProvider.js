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

function buildPrompt(resume, job) {
  return [
    "You are part of a multi-agent job matching backend.",
    "Return strict JSON only with this exact shape:",
    "{",
    "  \"resume\": { \"skills\": string[], \"experience_level\": string },",
    "  \"job\": { \"title\": string, \"skills\": string[], \"role_level\": string },",
    "  \"match\": { \"score\": number, \"missing\": string[], \"strengths\": string[], \"reasoning\": string },",
    "  \"plan\": { \"roadmap\": string[] }",
    "}",
    "Rules:",
    "- Score must be 0 to 100.",
    "- job.title must be the best inferred job title from the posting.",
    "- Skills should be lowercase concise tokens.",
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
      parsed.meta = { provider: "openai" };
      return parsed;
    }
  };
}

module.exports = {
  createOpenAIProvider
};
