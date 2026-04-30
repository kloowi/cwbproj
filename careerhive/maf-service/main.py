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
    enhance_resume,
)

load_dotenv()

AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

_kernel: Kernel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _kernel
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY or not AZURE_OPENAI_DEPLOYMENT:
        raise RuntimeError(
            "Azure OpenAI configuration is incomplete "
            "(AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT required)."
        )
    _kernel = build_kernel(AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION)
    yield


app = FastAPI(title="MAF Service", version="1.0.0", lifespan=lifespan)


class PipelineRequest(BaseModel):
    resume: str
    job: str


class EnhanceResumeRequest(BaseModel):
    resume: str
    jobTitle: str = ""
    jobSkills: list = []
    missing: list = []
    strengths: list = []
    improvements: list = []
    roadmap: list = []


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


@app.post("/enhance-resume")
async def run_enhance_resume(req: EnhanceResumeRequest):
    try:
        result = await enhance_resume(
            _kernel,
            req.resume,
            req.jobTitle,
            req.jobSkills,
            req.missing,
            req.strengths,
            req.improvements,
            req.roadmap,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
