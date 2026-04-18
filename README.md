# 🚀 CareerHive — Deployment Guide (Multi-Agent System)

## 📌 Overview
JobPilot AI is a multi-agent career assistant consisting of a frontend UI, backend API, and AI agent pipeline (Resume Agent, Job Agent, Matching Agent, Planner Agent). The system processes resume + job description inputs and returns structured career insights.

This deployment guide supports Azure infrastructure even when Azure AI Foundry model quota is unavailable.

## 🧠 Architecture
Frontend (React/Next.js) → Backend API (Node.js/FastAPI) → Multi-Agent Orchestrator (Semantic Kernel optional) → LLM API (Groq/OpenAI/Azure Foundry later) → Structured JSON → Frontend Rendering

Agents:
- Resume Agent → extracts skills, projects, experience level
- Job Agent → extracts required skills and role level
- Matching Agent → computes match score, gaps, reasoning
- Planner Agent → generates roadmap and learning plan

## ⚙️ Requirements
- Node.js 20
- Python 3.9+ (if FastAPI used)
- npm/yarn
- Git
- LLM API key (Groq)

## 📁 Project Structure
jobpilot-ai/
├── frontend/
├── backend/
│   ├── agents/
│   ├── routes/
│   ├── services/
│   └── server.js / main.py
├── shared/
├── .env
├── package.json

## 🔑 Environment Variables
Create backend .env:
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=5050

Alternative provider:
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini

Note:
- Azure AI Foundry settings are optional and can be added later after quota is granted.

## 🧠 Backend Setup
cd backend
npm install
npm run dev
OR (FastAPI)
pip install -r requirements.txt
uvicorn main:app --reload --port 5000

## 🔌 API Endpoint
POST /analyze
Request:
{
  "resume": "text",
  "job": "text"
}

Pipeline:
Resume Agent → Job Agent → Matching Agent → Planner Agent

Response:
{
  "resume": {...},
  "job": {...},
  "match": {
    "score": 72,
    "missing_skills": ["AWS", "GraphQL"]
  },
  "plan": {
    "roadmap": ["Learn AWS basics", "Build GraphQL API"]
  }
}

## 🌐 Frontend Setup
cd frontend
npm install
npm run dev
Frontend runs at: http://localhost:3000

## 🔗 Connect Frontend to Backend
const res = await fetch("http://localhost:5000/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ resume, job })
});
const data = await res.json();

## ☁️ Deployment (Production)

Frontend: Azure Static Web Apps / Vercel / Netlify
Backend: Azure App Service / Azure Container Apps / Render / Railway / Fly.io

Azure App Service steps:
- Push to GitHub
- Create Web App (Node 18+)
- Set Startup command (npm run start)
- Add environment variables in Configuration
- Enable Application Insights

Render steps:
- Push to GitHub
- Create Web Service
- Build: npm install
- Start: npm run start
- Add env variables

Azure Static Web Apps:
- Import repository
- Set frontend app location
- Add API base URL environment variable
- Deploy

Vercel:
- Import repo
- Set NEXT_PUBLIC_API_URL
- Deploy

## 🧠 AI Agent Rules
- Each agent must be independent
- All outputs must be strict JSON
- No mixed text responses
- Always include reasoning fields

## 🔒 Privacy Notice
- Resume and job description data are processed for AI analysis.
- Stored analysis history includes preview snippets (first 250 chars of resume and job text), score, gaps, roadmap, provider, and timestamp.
- Analysis history retention target is 30 days.
- Users can delete individual records from Dashboard > Application History using the delete icon on each card.

## ⚠️ Common Issues
CORS error:
app.use(cors({ origin: "*" }));

Empty response:
- Fix prompt formatting
- Ensure JSON-only output

Slow performance:
- Reduce model size
- Parallelize agents

No Foundry quota yet:
- Keep LLM_PROVIDER=groq or openai
- Deploy app infrastructure on Azure
- Add Foundry mode later without changing API response contract

## 🏁 Final Checklist
- Frontend connected to backend
- /analyze working
- Match score displayed
- Skill gaps generated
- Roadmap generated
- JSON parsing stable

## 💥 Result
This system becomes a full agentic AI product, not just a chatbot or UI demo. It demonstrates multi-agent architecture, structured reasoning, and real-world job matching capability.