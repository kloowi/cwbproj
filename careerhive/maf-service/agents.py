import json
import re

from semantic_kernel import Kernel
from semantic_kernel.connectors.ai.open_ai import (
    AzureChatCompletion,
    AzureChatPromptExecutionSettings,
)
from semantic_kernel.contents.chat_history import ChatHistory


def build_kernel(endpoint: str, api_key: str, deployment: str, api_version: str) -> Kernel:
    kernel = Kernel()
    kernel.add_service(
        AzureChatCompletion(
            deployment_name=deployment,
            endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
    )
    return kernel


async def call_agent(kernel: Kernel, prompt: str) -> dict:
    history = ChatHistory()
    history.add_system_message("You return JSON only.")
    history.add_user_message(prompt)

    service: AzureChatCompletion = kernel.get_service()
    settings = AzureChatPromptExecutionSettings(
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    result = await service.get_chat_message_contents(history, settings=settings)
    text = result[0].content if result else "{}"
    return _parse_json(text)


def _parse_json(text: str) -> dict:
    trimmed = text.strip()
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", trimmed)
        if not m:
            raise ValueError("Model response is not valid JSON.")
        return json.loads(m.group(0))


# --- normalizers ---

def _normalize_array(value) -> list[str]:
    if not isinstance(value, list):
        return []
    seen = set()
    result = []
    for item in value:
        token = str(item).strip().lower()
        if token and token not in seen:
            seen.add(token)
            result.append(token)
    return result


def _normalize_level(value, fallback: str = "junior") -> str:
    normalized = str(value or "").strip().lower()
    if normalized in ("junior", "mid", "senior", "lead"):
        return normalized
    return fallback


def _normalize_role_title(value) -> str:
    title = str(value or "").strip()
    return title[:120]


def _normalize_interview_questions(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or "").strip()
        answer = str(item.get("answer") or "").strip()
        focus = str(item.get("focusSkill") or item.get("focus_skill") or "").strip()
        if prompt and answer:
            result.append({"prompt": prompt, "answer": answer, "focusSkill": focus})
    return result[:4]


# --- prompt builders ---

def _build_resume_prompt(resume: str) -> str:
    return "\n".join([
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
        "Resume:",
        resume,
    ])


def _build_job_prompt(job: str) -> str:
    return "\n".join([
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
        "Job Description:",
        job,
    ])


def _build_matching_prompt(resume_data: dict, job_data: dict) -> str:
    return "\n".join([
        "You are Matching Agent.",
        "Compare resume and job data and compute a conservative match score.",
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
        "Resume Data:",
        json.dumps(resume_data),
        "Job Data:",
        json.dumps(job_data),
    ])


def _build_planner_prompt(context: dict) -> str:
    return "\n".join([
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
        "Context:",
        json.dumps(context),
    ])


def _build_interview_prompt(context: dict) -> str:
    return "\n".join([
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
        "Context:",
        json.dumps(context),
    ])


# --- agent functions ---

async def extract_resume(kernel: Kernel, resume_text: str) -> dict:
    raw = await call_agent(kernel, _build_resume_prompt(resume_text))
    return {
        "skills": _normalize_array(raw.get("skills")),
        "experience_level": _normalize_level(raw.get("experience_level")),
    }


async def extract_job(kernel: Kernel, job_text: str) -> dict:
    raw = await call_agent(kernel, _build_job_prompt(job_text))
    return {
        "title": _normalize_role_title(raw.get("title")),
        "skills": _normalize_array(raw.get("skills")),
        "role_level": _normalize_level(raw.get("role_level")),
    }


async def match_skills(kernel: Kernel, resume: dict, job: dict) -> dict:
    resume_skills = _normalize_array(resume.get("skills"))
    job_skills = _normalize_array(job.get("skills"))

    raw = await call_agent(kernel, _build_matching_prompt(
        {**resume, "skills": resume_skills},
        {**job, "skills": job_skills},
    ))

    llm_strengths = _normalize_array(raw.get("strengths"))
    exact_strengths = [s for s in resume_skills if s in job_skills]
    strengths = list(dict.fromkeys(
        exact_strengths + [s for s in llm_strengths if s in resume_skills and s in job_skills]
    ))

    missing = [s for s in job_skills if s not in strengths]
    overlap_score = 55 if not job_skills else round(len(strengths) / len(job_skills) * 100)

    return {
        "score": overlap_score,
        "missing": missing,
        "strengths": strengths,
        "reasoning": str(raw.get("reasoning") or f"Matched {len(strengths)} of {len(job_skills) or 1} required skills.").strip(),
    }


async def plan_roadmap(kernel: Kernel, resume: dict, job: dict, match_result: dict) -> dict:
    raw = await call_agent(kernel, _build_planner_prompt({"resume": resume, "job": job, "match": match_result}))
    roadmap = raw.get("roadmap")
    improvements = raw.get("improvements")
    return {
        "roadmap": [str(s).strip() for s in roadmap if str(s).strip()][:5] if isinstance(roadmap, list) else [],
        "improvements": [str(s).strip() for s in improvements if str(s).strip()][:3] if isinstance(improvements, list) else [],
    }


async def generate_interview_questions(
    kernel: Kernel,
    resume: dict,
    job: dict,
    match_result: dict,
    plan: dict,
) -> dict:
    raw = await call_agent(kernel, _build_interview_prompt({
        "resume": resume,
        "job": job,
        "match": match_result,
        "plan": plan,
    }))
    return {"questions": _normalize_interview_questions(raw.get("questions"))}


async def enhance_resume(
    kernel: Kernel,
    resume_text: str,
    job_title: str,
    job_skills: list,
    missing: list,
    strengths: list,
    improvements: list,
    roadmap: list,
) -> dict:
    skills_line = ", ".join(job_skills) if job_skills else "not specified"
    strengths_line = ", ".join(strengths) if strengths else "none identified"
    missing_line = ", ".join(missing) if missing else "none"
    improvements_block = "\n".join(f"- {i}" for i in improvements) if improvements else "- No specific improvements listed"
    roadmap_block = "\n".join(f"- {r}" for r in roadmap) if roadmap else "- No roadmap items"

    prompt = f"""You are a professional resume writer. Rewrite the resume below so it is tailored to the target role.

Target role: {job_title}
Required skills for the role: {skills_line}
Candidate's existing strengths (already present): {strengths_line}
Skills to incorporate or highlight more strongly: {missing_line}
Specific improvements to apply:
{improvements_block}
Roadmap achievements to reflect where applicable:
{roadmap_block}

Original resume:
\"\"\"
{resume_text}
\"\"\"

Rules:
- Do NOT invent jobs, degrees, company names, dates, or credentials that are not in the original.
- Rewrite existing bullet points to emphasise relevance to the target role.
- Naturally weave in the listed skills only where they honestly apply to real experience shown.
- Apply every specific improvement listed above.
- Output a clean, plain-text resume with standard sections: Summary, Experience, Skills, Education (and any other sections present in the original).
- Return JSON with a single key: {{"enhancedResume": "<full resume as a plain-text string with \\n line breaks>"}}"""

    raw = await call_agent(kernel, prompt)
    return {"enhancedResume": str(raw.get("enhancedResume", "")).strip()}
