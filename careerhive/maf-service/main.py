import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agents import (
    build_kernel,
    extract_resume,
    extract_job,
    match_skills,
    plan_roadmap,
    generate_interview_questions,
)

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

app = FastAPI(title="MAF Service", version="1.0.0")


class PipelineRequest(BaseModel):
    resume: str
    job: str


@app.get("/health")
async def health():
    return {"ok": True, "service": "maf-service", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/pipeline")
async def run_pipeline(req: PipelineRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    try:
        kernel = build_kernel(GROQ_API_KEY, GROQ_MODEL)

        resume = await extract_resume(kernel, req.resume)
        job = await extract_job(kernel, req.job)
        match = await match_skills(kernel, resume, job)
        plan = await plan_roadmap(kernel, resume, job, match)
        interview = await generate_interview_questions(kernel, resume, job, match, plan)

        return {
            "resume": resume,
            "job": job,
            "match": match,
            "plan": plan,
            "interview": interview,
            "meta": {"provider": "maf-sk", "pipeline": "staged"},
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
