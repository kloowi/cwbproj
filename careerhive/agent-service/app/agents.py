"""Microsoft Agent Framework agent definitions for the CareerHive pipeline.

Each Agent corresponds to one stage in the staged orchestration boundary
documented in careerhive/backend/src/services/semanticKernelOrchestrator.js.
Prompts mirror the JSON-only contracts already used by the Groq provider so
output schemas remain backward-compatible.
"""
from __future__ import annotations

import os
from functools import lru_cache

from agent_framework import Agent
from agent_framework.openai import OpenAIChatClient


SYSTEM_JSON_ONLY = "You return JSON only."

RESUME_INSTRUCTIONS = "\n".join([
    "You are Resume Agent.",
    "Extract structured profile data from the resume.",
    "Return strict JSON only with this shape:",
    "{",
    '  "skills": string[],',
    '  "experience_level": string',
    "}",
    "Rules:",
    "- skills must be lowercase concise tokens and use canonical forms when obvious (e.g., software, ai, cloud, aws, react, node).",
    "- experience_level must be one of: junior, mid, senior, lead.",
    "- no markdown, no extra keys.",
])

JOB_INSTRUCTIONS = "\n".join([
    "You are Job Agent.",
    "Extract required capabilities from the job description.",
    "Return strict JSON only with this shape:",
    "{",
    '  "title": string,',
    '  "skills": string[],',
    '  "role_level": string',
    "}",
    "Rules:",
    "- title must be the most likely job title from the posting (for example: Senior Backend Engineer).",
    "- skills must be lowercase concise tokens and use canonical forms when obvious (e.g., software, ai, cloud, aws, react, node).",
    "- role_level must be one of: junior, mid, senior, lead.",
    "- no markdown, no extra keys.",
])

MATCH_INSTRUCTIONS = "\n".join([
    "You are Matching Agent.",
    "Compare resume and job data and produce a conservative analysis.",
    "Return strict JSON only with this shape:",
    "{",
    '  "missing": string[],',
    '  "strengths": string[],',
    '  "reasoning": string',
    "}",
    "Rules:",
    "- missing: required skills not shown in resume.",
    "- strengths: overlapping skills.",
    "- reasoning must be concise and factual.",
    "- no markdown, no extra keys.",
])

PLANNER_INSTRUCTIONS = "\n".join([
    "You are Planner Agent.",
    "Generate a focused roadmap based on missing skills.",
    "Return strict JSON only with this shape:",
    "{",
    '  "roadmap": string[],',
    '  "improvements": string[]',
    "}",
    "Rules:",
    "- roadmap: 3 to 5 concise actionable steps.",
    "- improvements: exactly 3 actionable resume edits (wording, keywords, formatting) to pass ATS.",
    "- prioritize high-impact missing skills first.",
    "- no markdown, no extra keys.",
])

INTERVIEW_INSTRUCTIONS = "\n".join([
    "You are Interview Prep Agent.",
    "Generate role-correlated interview questions and concise model answers.",
    "Return strict JSON only with this shape:",
    "{",
    '  "questions": [',
    '    { "prompt": string, "answer": string, "focusSkill": string }',
    "  ]",
    "}",
    "Rules:",
    "- Generate exactly 4 questions.",
    "- Questions must align to the target role title, required skills, missing skills, and strengths.",
    "- Answers should be practical, concise, and interview-ready.",
    "- focusSkill should point to the main competency tested by the question.",
    "- No markdown, no extra keys.",
])


def _chat_client() -> OpenAIChatClient:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is missing.")
    base_url = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    return OpenAIChatClient(model=model, api_key=api_key, base_url=base_url)


def _build(client: OpenAIChatClient, name: str, instructions: str) -> Agent:
    return client.as_agent(
        name=name,
        instructions=f"{SYSTEM_JSON_ONLY}\n{instructions}",
    )


@lru_cache(maxsize=1)
def build_agents() -> dict[str, Agent]:
    client = _chat_client()
    return {
        "resume": _build(client, "ResumeAgent", RESUME_INSTRUCTIONS),
        "job": _build(client, "JobAgent", JOB_INSTRUCTIONS),
        "match": _build(client, "MatchingAgent", MATCH_INSTRUCTIONS),
        "plan": _build(client, "PlannerAgent", PLANNER_INSTRUCTIONS),
        "interview": _build(client, "InterviewAgent", INTERVIEW_INSTRUCTIONS),
    }
