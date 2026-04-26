# CareerHive Agent Service

A Python sidecar that runs the CareerHive analysis pipeline on the official
[Microsoft Agent Framework](https://learn.microsoft.com/agent-framework/)
(`agent-framework` Python package). The Node backend's
`semanticKernelOrchestrator.js` calls this service over HTTP; if it is not
running, the backend falls back to its in-process pipeline.

## Pipeline

Five `ChatAgent`s are chained in sequence:

1. **ResumeAgent** — extracts `{ skills, experience_level }`
2. **JobAgent** — extracts `{ title, skills, role_level }`
3. **MatchingAgent** — produces `{ missing, strengths, reasoning }`
4. **PlannerAgent** — produces `{ roadmap, improvements }`
5. **InterviewAgent** — produces `{ questions: [...] }`

All agents share an `OpenAIChatClient` configured against Groq's
OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`).

## Run

    cp .env.example .env          # set GROQ_API_KEY
    pip install -e .              # or: uv sync
    uvicorn app.main:app --port 7070

## Endpoints

- `GET /health` — `{ "ok": true, "provider": "microsoft-agent-framework" }`
- `POST /pipeline` — body `{ "resume": "...", "job": "..." }`, returns the same
  response shape used by the Node orchestrator (`resume`, `job`, `match`,
  `plan`, `interview`, `meta`).

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | — | Required. Groq API key. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model id. |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible base URL. |
| `PORT` | `7070` | Sidecar port. |
