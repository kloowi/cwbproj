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

function buildInterviewQuestions(jobSkills, experienceLevel, difficulty = "Intermediate") {
  const questions = [];
  const baseQuestions = [
    {
      category: "Technical",
      question: "Describe a project where you used " + (jobSkills[0] || "a core technology") + ".",
      answer: "In my previous role, I built a scalable " + (jobSkills[0] || "application") + " that improved performance by 40%. I focused on clean code, testing, and monitoring. The key challenge was integrating with legacy systems, which I solved by creating an adapter layer."
    },
    {
      category: "Behavioral",
      question: "Tell me about a time you had to learn a new skill under pressure.",
      answer: "When our team needed to adopt " + (jobSkills[1] || "a new framework") + " for an urgent project, I spent a weekend learning the core concepts. I then led a knowledge-sharing session with the team, ensuring everyone was up to speed within 2 days."
    },
    {
      category: "System Design",
      question: "How would you design a system for " + (jobSkills[2] ? "handling complex " + jobSkills[2] + " workflows" : "handling high traffic") + "?",
      answer: "I would design a microservices architecture with event-driven communication. The API layer handles requests, services are independently scalable, and we use a message queue for async operations. Monitoring and caching are critical for performance."
    },
    {
      category: "Technical",
      question: "What are common pitfalls in " + (jobSkills[0] || "web development") + " and how do you avoid them?",
      answer: "Common issues include poor error handling, inadequate testing, and missing observability. I prevent these through comprehensive unit and integration tests, structured logging, and proactive code reviews."
    }
  ];

  return baseQuestions.slice(0, difficulty === "Basic" ? 2 : difficulty === "Advanced" ? 4 : 3).map((q) => ({
    category: q.category,
    question: q.question,
    answer: q.answer,
    tips: [
      "Be specific with examples from your experience.",
      "Highlight your problem-solving approach.",
      "Keep answers to 2-3 minutes."
    ]
  }));
}

function buildInterviewTips(difficulty = "Intermediate") {
  const baseTips = [
    "Research the company thoroughly before the interview.",
    "Prepare concrete examples using the STAR method (Situation, Task, Action, Result).",
    "Ask thoughtful questions about the role, team, and company culture.",
    "Follow up with a thank-you email within 24 hours.",
    "Practice writing code on a whiteboard or shared editor beforehand.",
    "Be prepared to explain your problem-solving process, not just final solutions.",
    "Be honest about what you don't know—show willingness to learn.",
    "Get proper sleep the night before and arrive 10 minutes early."
  ];

  return difficulty === "Basic" ? baseTips.slice(0, 4) : difficulty === "Advanced" ? baseTips : baseTips.slice(0, 6);
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
      const resumeSkills = canonicalizeSkillList(Array.isArray(resume?.skills) ? resume.skills : []);
      const jobSkills = canonicalizeSkillList(Array.isArray(job?.skills) ? job.skills : []);
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
    },
    async generateQuestions({ resume, job, difficulty = "Intermediate" }) {
      const resumeData = await this.extractResume(resume);
      const jobData = await this.extractJob(job);
      const jobSkills = Array.isArray(jobData?.skills) ? jobData.skills : [];
      return {
        questions: buildInterviewQuestions(jobSkills, resumeData.experience_level, difficulty)
      };
    },
    async generateTips({ job, difficulty = "Intermediate" }) {
      return {
        tips: buildInterviewTips(difficulty)
      };
    },
    async assessAnswers({ question, userAnswer, modelAnswer }) {
      const userLen = (String(userAnswer) || "").trim().length;
      const modelLen = (String(modelAnswer) || "").trim().length;
      const ratio = userLen > 0 ? userLen / modelLen : 0;

      let score = 70;
      if (ratio < 0.3) score -= 20;
      else if (ratio < 0.6) score -= 10;
      if (ratio > 1.5) score -= 5;

      return {
        score: Math.min(100, Math.max(0, score)),
        feedback: "Good effort. Your answer covers the key points. Consider adding more specific examples from your experience.",
        highlights: [
          "Clear communication of the main idea.",
          "Relevant technical details included."
        ],
        improvements: [
          "Add a concrete project example to strengthen credibility.",
          "Briefly mention the impact or outcome of your work."
        ]
      };
    }
  };
}

module.exports = {
  createFallbackProvider
};
