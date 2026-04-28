import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from semantic_kernel import Kernel

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

_kernel: Kernel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _kernel
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    _kernel = build_kernel(GROQ_API_KEY, GROQ_MODEL)
    yield


app = FastAPI(title="MAF Service", version="1.0.0", lifespan=lifespan)


class PipelineRequest(BaseModel):
    resume: str
    job: str


@app.get("/health")
async def health():
    return {"ok": True, "service": "maf-service", "time": datetime.now(timezone.utc).isoformat()}


@app.post("/pipeline")
async def run_pipeline(req: PipelineRequest):
    try:
        resume, job = await asyncio.gather(
            extract_resume(_kernel, req.resume),
            extract_job(_kernel, req.job),
        )
        match = await match_skills(_kernel, resume, job)
        plan = await plan_roadmap(_kernel, resume, job, match)
        interview = await generate_interview_questions(_kernel, resume, job, match, plan)

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
