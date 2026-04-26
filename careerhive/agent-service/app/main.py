import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

load_dotenv()

from .pipeline import run_pipeline  # noqa: E402  (load_dotenv first)


class PipelineRequest(BaseModel):
    resume: str
    job: str


app = FastAPI(title="CareerHive Agent Service", version="0.1.0")


@app.get("/health")
async def health():
    return {"ok": True, "provider": "microsoft-agent-framework"}


@app.post("/pipeline")
async def pipeline(req: PipelineRequest):
    if not req.resume.strip() or not req.job.strip():
        raise HTTPException(status_code=400, detail="resume and job are required")
    try:
        return await run_pipeline(req.resume, req.job)
    except Exception as exc:  # surface as 502 so Node falls back cleanly
        raise HTTPException(status_code=502, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "7070")),
        reload=False,
    )
