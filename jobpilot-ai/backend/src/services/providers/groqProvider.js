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
  return {
    name: "groq",
    async analyze({ resume, job }) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing.");
      }

      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const client = new OpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1"
      });

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You return JSON only."
          },
          {
            role: "user",
            content: buildPrompt(resume, job)
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const text = response.choices?.[0]?.message?.content || "{}";
      const parsed = parseJsonResponse(text);
      parsed.meta = { provider: "groq" };
      return parsed;
    }
  };
}

module.exports = {
  createGroqProvider
};
