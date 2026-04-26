# CareerHive AI Scaffold

This scaffold gives you a strict MVP flow:

- Input resume + job description
- Return match score + missing skills + roadmap
- Support provider switching (groq)
- Fallback to deterministic keyword matching when provider fails

## Structure

- backend: Express API with analyze route and provider adapters
- frontend: Vite app with single-page analyzer UI

## Backend run

1. Copy environment file:
   cp .env.example .env
2. Set provider variables (Groq)
3. Run:
   npm run start

Backend runs on http://localhost:5050 by default.

## Frontend run

1. Copy environment file:
   cp .env.example .env
2. Run:
   npm run dev

Frontend reads VITE_API_URL and defaults to http://localhost:5050.

## API

POST /analyze

Request:
{
  "resume": "text",
  "job": "text"
}

Response shape:
{
  "resume": { "skills": [], "experience_level": "junior|mid|senior" },
  "job": { "skills": [], "role_level": "junior|mid|senior" },
  "match": {
    "score": 0,
    "missing": [],
    "strengths": [],
    "reasoning": "text"
  },
  "plan": { "roadmap": [] },
  "meta": { "provider": "groq|fallback-keyword" }
}

## Microsoft Agent Framework

The staged orchestration boundary in `backend/src/services/semanticKernelOrchestrator.js`
delegates to a Python sidecar (`agent-service/`) that runs the official
[Microsoft Agent Framework](https://learn.microsoft.com/agent-framework/) (`agent-framework`
Python package). The sidecar exposes `POST /pipeline` which runs five `ChatAgent`s
(Resume → Job → Matching → Planner → Interview) backed by an OpenAI-compatible
`OpenAIChatClient` pointed at Groq. The `POST /analyze` API contract is unchanged.

### Run the sidecar

    cd agent-service
    cp .env.example .env   # set GROQ_API_KEY
    pip install -e .       # or: uv sync
    uvicorn app.main:app --port 7070

Then start the backend with `AGENT_SERVICE_URL=http://localhost:7070` (already in
`backend/.env.example`). If the sidecar is unset or unreachable, the backend
transparently falls back to the in-process staged pipeline.
