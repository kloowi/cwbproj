const SKILL_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "node",
  "express",
  "python",
  "fastapi",
  "sql",
  "postgresql",
  "mongodb",
  "docker",
  "kubernetes",
  "azure",
  "aws",
  "gcp",
  "git",
  "ci/cd",
  "rest",
  "graphql",
  "testing",
  "jest",
  "tailwind",
  "next.js",
  "ai",
  "cloud",
  "software",
  "web",
  "mobile",
  "system design"
];

const { canonicalizeSkillList } = require("../skillCanonicalizer");

function detectSkills(text) {
  const normalized = text.toLowerCase();
  return canonicalizeSkillList(SKILL_KEYWORDS.filter((keyword) => normalized.includes(keyword)));
}

function summarizeLevel(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("senior") || normalized.includes("lead")) return "senior";
  if (normalized.includes("mid") || normalized.includes("3+ years")) return "mid";
  return "junior";
}

function buildRoadmap(missingSkills) {
  if (missingSkills.length === 0) {
    return [
      "Week 1: Build one portfolio project tailored to the target role.",
      "Week 2: Practice mock interviews using project deep dives."
    ];
  }

  return missingSkills.slice(0, 3).map((skill, idx) => {
    return `Week ${idx + 1}: Build practical competency in ${skill}.`;
  });
}

function inferJobTitle(jobText) {
  const normalized = String(jobText || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Software Engineer";
  const firstLine = normalized.split(/[\n\.]/)[0].trim();
  if (!firstLine) return "Software Engineer";
  return firstLine.slice(0, 120);
}

function toQuestionSet({ title, missing, strengths, roadmap }) {
  const roleTitle = String(title || "Software Engineer").trim() || "Software Engineer";
  const topMissing = missing[0] || "a required capability for this role";
  const secondMissing = missing[1] || topMissing;
  const topStrength = strengths[0] || "a relevant project you delivered";
  const roadmapFocus = roadmap[0] || `closing your highest-priority gap for ${roleTitle}`;

  return {
    questions: [
      {
        prompt: `For the ${roleTitle} role, how would you build competency in ${topMissing} during your first 60 days?`,
        answer: `I would break ${topMissing} into weekly learning and delivery milestones, apply it to one scoped team objective, and review outcomes with stakeholders to prove progress and practical impact.`,
        focusSkill: topMissing
      },
      {
        prompt: `Tell me about a time your strength in ${topStrength} improved an outcome.`,
        answer: "I would answer with context, constraints, actions, and measurable results, then explain the tradeoffs I made and what I would improve in the next iteration.",
        focusSkill: topStrength
      },
      {
        prompt: `If interviewers identify ${secondMissing} as a risk, how would you respond?`,
        answer: `I would acknowledge the gap directly, share a concrete upskilling plan with timelines, and provide evidence from recent practice or project work to show execution momentum.`,
        focusSkill: secondMissing
      },
      {
        prompt: `What trends are most relevant to this role, and how would they influence your decisions around ${roadmapFocus}?`,
        answer: "I would connect current industry trends to architecture and prioritization choices, then describe how those signals guide reliability, user impact, and delivery risk tradeoffs.",
        focusSkill: roadmapFocus
      }
    ]
  };
}

function createFallbackProvider() {
  return {
    name: "fallback-keyword",
    async extractResume(resumeText) {
      return {
        skills: detectSkills(resumeText),
        experience_level: summarizeLevel(resumeText)
      };
    },
    async extractJob(jobText) {
      return {
        title: inferJobTitle(jobText),
        skills: detectSkills(jobText),
        role_level: summarizeLevel(jobText)
      };
    },
    async matchSkills({ resume, job }) {
      const resumeSkills = canonicalizeSkillList(Array.isArray(resume?.skills) ? resume.skills : []);
      const jobSkills = canonicalizeSkillList(Array.isArray(job?.skills) ? job.skills : []);
      let strengths = resumeSkills.filter((skill) => jobSkills.includes(skill));
      let missing = jobSkills.filter((skill) => !resumeSkills.includes(skill));

      // Ensure at least 2 strengths using real resume skills
      if (strengths.length < 2) {
        const extra = resumeSkills.filter((s) => !strengths.includes(s));
        strengths = [...strengths, ...extra.slice(0, 2 - strengths.length)];
      }

      // Ensure at least 2 missing using real job skills
      if (missing.length < 2) {
        const extra = jobSkills.filter((s) => !missing.includes(s));
        missing = [...missing, ...extra.slice(0, 2 - missing.length)];
      }

      const score = jobSkills.length === 0
        ? 60
        : Math.round((strengths.length / jobSkills.length) * 100);

      return {
        score,
        missing,
        strengths,
        reasoning: `Matched ${strengths.length} out of ${jobSkills.length || 1} detected job skills.`
      };
    },
    async planRoadmap({ match }) {
      const missingSkills = Array.isArray(match?.missing) ? match.missing : [];
      return {
        roadmap: buildRoadmap(missingSkills),
        improvements: missingSkills.slice(0, 3).map((skill) => `Add concrete evidence of ${skill} with one measurable bullet.`)
      };
    },
    async generateInterviewQuestions({ job, match, plan }) {
      const missing = Array.isArray(match?.missing) ? match.missing : [];
      const strengths = Array.isArray(match?.strengths) ? match.strengths : [];
      const roadmap = Array.isArray(plan?.roadmap) ? plan.roadmap : [];
      return toQuestionSet({
        title: job?.title,
        missing,
        strengths,
        roadmap
      });
    },
    async analyze({ resume, job }) {
      const resumeData = await this.extractResume(resume);
      const jobData = await this.extractJob(job);
      const matchData = await this.matchSkills({ resume: resumeData, job: jobData });
      const planData = await this.planRoadmap({ match: matchData });
      const interviewData = await this.generateInterviewQuestions({ job: jobData, match: matchData, plan: planData });

      return {
        resume: resumeData,
        job: jobData,
        match: matchData,
        plan: planData,
        interview: interviewData,
        meta: {
          provider: "fallback-keyword"
        }
      };
    }
  };
}

module.exports = {
  createFallbackProvider
};
