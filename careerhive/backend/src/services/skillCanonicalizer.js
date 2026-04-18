const CANONICAL_RULES = [
  [/artificial intelligence|machine learning|nlp|chatbot|llm/gi, "ai"],
  [/software engineer|software engineering|software development/gi, "software"],
  [/cloud computing|cloud platform|cloud api|cloud service/gi, "cloud"],
  [/web development|web app|web application/gi, "web"],
  [/mobile development|mobile app|android|ios/gi, "mobile"],
  [/system design|architecture/gi, "system design"],
  [/node\.js|nodejs/gi, "node"],
  [/react\.js|reactjs/gi, "react"],
  [/restful|rest api/gi, "rest"],
  [/amazon web services/gi, "aws"],
  [/google cloud platform|google cloud/gi, "gcp"]
];

function normalizeSkillToken(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";

  for (const [pattern, canonical] of CANONICAL_RULES) {
    if (pattern.test(value)) return canonical;
  }

  return value;
}

function canonicalizeSkillList(skills) {
  if (!Array.isArray(skills)) return [];
  return [...new Set(skills.map(normalizeSkillToken).filter(Boolean))];
}

module.exports = {
  canonicalizeSkillList,
  normalizeSkillToken
};
