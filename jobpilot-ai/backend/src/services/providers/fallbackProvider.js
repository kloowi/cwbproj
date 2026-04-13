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
  "next.js"
];

function detectSkills(text) {
  const normalized = text.toLowerCase();
  return SKILL_KEYWORDS.filter((keyword) => normalized.includes(keyword));
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
        skills: detectSkills(jobText),
        role_level: summarizeLevel(jobText)
      };
    },
    async matchSkills({ resume, job }) {
      const resumeSkills = Array.isArray(resume?.skills) ? resume.skills : [];
      const jobSkills = Array.isArray(job?.skills) ? job.skills : [];
      const strengths = resumeSkills.filter((skill) => jobSkills.includes(skill));
      const missing = jobSkills.filter((skill) => !resumeSkills.includes(skill));
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
        roadmap: buildRoadmap(missingSkills)
      };
    },
    async analyze({ resume, job }) {
      const resumeData = await this.extractResume(resume);
      const jobData = await this.extractJob(job);
      const matchData = await this.matchSkills({ resume: resumeData, job: jobData });
      const planData = await this.planRoadmap({ match: matchData });

      return {
        resume: resumeData,
        job: jobData,
        match: matchData,
        plan: planData,
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
