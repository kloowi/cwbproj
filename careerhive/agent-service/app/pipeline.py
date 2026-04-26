"""Staged orchestration: ResumeAgent -> JobAgent -> MatchingAgent -> PlannerAgent -> InterviewAgent.

Uses explicit per-stage `agent.run(...)` calls rather than SequentialBuilder
because each stage needs structured-JSON inputs derived from prior outputs,
which the framework's shared-conversation chaining does not give us.
"""
from __future__ import annotations

import json
import re

from .agents import build_agents
from .canonicalize import canonicalize_skill_list


VALID_LEVELS = {"junior", "mid", "senior", "lead"}


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise ValueError("Agent response is not valid JSON.")
        return json.loads(m.group(0))


def _normalize_array(value) -> list[str]:
    if not isinstance(value, list):
        return []
    seen = []
    for v in value:
        s = str(v).strip().lower()
        if s and s not in seen:
            seen.append(s)
    return seen


def _normalize_level(value, fallback="junior") -> str:
    v = str(value or "").strip().lower()
    return v if v in VALID_LEVELS else fallback


def _normalize_role_title(value) -> str:
    title = str(value or "").strip()
    return title[:120]


def _normalize_interview_questions(items) -> list[dict]:
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or "").strip()
        answer = str(item.get("answer") or "").strip()
        focus = str(item.get("focusSkill") or item.get("focus_skill") or "").strip()
        if prompt and answer:
            out.append({"prompt": prompt, "answer": answer, "focusSkill": focus})
        if len(out) >= 4:
            break
    return out


async def _run(agent, prompt: str) -> dict:
    response = await agent.run(prompt)
    text = getattr(response, "text", None) or str(response)
    return _parse_json(text)


async def run_pipeline(resume_text: str, job_text: str) -> dict:
    agents = build_agents()

    resume_raw = await _run(agents["resume"], f"Resume:\n{resume_text}")
    resume = {
        "skills": canonicalize_skill_list(_normalize_array(resume_raw.get("skills"))),
        "experience_level": _normalize_level(resume_raw.get("experience_level")),
    }

    job_raw = await _run(agents["job"], f"Job Description:\n{job_text}")
    job = {
        "title": _normalize_role_title(job_raw.get("title")),
        "skills": canonicalize_skill_list(_normalize_array(job_raw.get("skills"))),
        "role_level": _normalize_level(job_raw.get("role_level")),
    }

    match_prompt = (
        f"Resume Data:\n{json.dumps(resume)}\n"
        f"Job Data:\n{json.dumps(job)}"
    )
    match_raw = await _run(agents["match"], match_prompt)

    resume_skills = resume["skills"]
    job_skills = job["skills"]
    llm_strengths = canonicalize_skill_list(_normalize_array(match_raw.get("strengths")))
    exact_strengths = [s for s in resume_skills if s in job_skills]
    strengths: list[str] = []
    for s in exact_strengths + [s for s in llm_strengths if s in resume_skills and s in job_skills]:
        if s not in strengths:
            strengths.append(s)
    missing = [s for s in job_skills if s not in strengths]
    overlap_score = 55 if not job_skills else round((len(strengths) / len(job_skills)) * 100)
    match = {
        "score": overlap_score,
        "missing": missing,
        "strengths": strengths,
        "reasoning": str(match_raw.get("reasoning") or f"Matched {len(strengths)} of {len(job_skills) or 1} required skills.").strip(),
    }

    plan_prompt = f"Context:\n{json.dumps({'resume': resume, 'job': job, 'match': match})}"
    plan_raw = await _run(agents["plan"], plan_prompt)
    roadmap = [str(s).strip() for s in (plan_raw.get("roadmap") or []) if str(s).strip()][:5]
    improvements = [str(s).strip() for s in (plan_raw.get("improvements") or []) if str(s).strip()][:3]
    plan = {"roadmap": roadmap, "improvements": improvements}

    interview_prompt = f"Context:\n{json.dumps({'resume': resume, 'job': job, 'match': match, 'plan': plan})}"
    interview_raw = await _run(agents["interview"], interview_prompt)
    interview = {"questions": _normalize_interview_questions(interview_raw.get("questions"))}

    return {
        "resume": resume,
        "job": job,
        "match": match,
        "plan": plan,
        "interview": interview,
        "meta": {
            "provider": "microsoft-agent-framework",
            "pipeline": "staged",
        },
    }
