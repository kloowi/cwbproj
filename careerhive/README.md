# CareerHive AI Scaffold

This scaffold gives you a strict MVP flow:

- Input resume + job description
- Return match score + missing skills + roadmap
- Support provider switching (groq, openai)
- Fallback to deterministic keyword matching when provider fails

## Structure

- backend: Express API with analyze route and provider adapters
- frontend: Vite app with single-page analyzer UI

## Backend run

1. Copy environment file:
   cp .env.example .env
2. Set provider variables (Groq or OpenAI)
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
  "meta": { "provider": "groq|openai|fallback-keyword" }
}

## Microsoft Framework Note

A semantic orchestration boundary exists in backend src/services/semanticKernelOrchestrator.js.
You can replace this implementation with an official Microsoft agent SDK without changing the API contract.
