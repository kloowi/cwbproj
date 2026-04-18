
# 📄 PRD — AI Job Hunt Copilot (Agentic Career Assistant)

## 1. Product Overview

### 🧠 Product Name (working):

**CareerHive AI**

### 🎯 Vision:

An AI-powered, multi-agent career assistant that helps users:

* analyze their resume
* understand job requirements
* compute match scores
* generate personalized career improvement plans
* prepare for interviews

### 💡 Core Idea:

Instead of a single AI chatbot, the system uses **specialized agents** that collaborate to simulate a recruiter + career coach + technical interviewer.

---

## 2. Problem Statement

Job seekers struggle with:

* not knowing why they are rejected
* unclear skill gaps vs job requirements
* generic resume advice
* poor interview preparation
* lack of structured career guidance

Existing tools:

* are static (ATS checkers)
* or generic AI chatbots without structure or reasoning transparency

---

## 3. Goals & Objectives

### ✅ Primary Goals

* Provide **structured resume-job matching**
* Show **transparent AI reasoning**
* Generate **actionable improvement plans**
* Improve interview readiness

### 📊 Success Metrics

* Users understand their skill gaps in < 30 seconds
* 70%+ of generated suggestions are actionable
* Demo clarity (judge immediately understands flow)

---

## 4. Target Users

### 🎓 Primary Users:

* College students
* Entry-level job seekers
* Junior developers

### 💼 Secondary Users:

* Career switchers
* Bootcamp graduates

---

## 5. Core Features

---

## 🧠 5.1 Multi-Agent System (Core Engine)

### Agents:

### 1. Resume Agent

**Purpose:** Extract structured skills and experience

**Input:**

* Resume text / PDF

**Output:**

```json
{
  "skills": [],
  "projects": [],
  "experience_level": "junior"
}
```

---

### 2. Job Description Agent

**Purpose:** Parse job requirements

**Output:**

```json
{
  "required_skills": [],
  "nice_to_have": [],
  "role_level": "mid-level"
}
```

---

### 3. Matching Agent

**Purpose:** Compute compatibility + gaps

**Output:**

* match score (0–100)
* missing skills
* strengths

---

### 4. Planner Agent

**Purpose:** Generate career roadmap

**Output:**

* prioritized learning plan
* weekly roadmap
* suggested projects

---

### 5. Interview Agent

**Purpose:** Generate interview prep questions

* technical Q&A
* behavioral questions
* model answers

---

## 🖥️ 5.2 UI Modules

---

### 📊 Dashboard

* Upload resume
* Paste job description
* View last analysis

---

### 🧠 Analysis Page (Core Screen)

Includes:

* Match Score Card
* Skill Gap Visualization
* Strengths / Weaknesses
* AI Reasoning Panel

---

### 🗺️ Career Roadmap Page

* Step-by-step skill plan
* Priority ranking
* Timeline view

---

### 🎤 Interview Prep Page

* Question bank
* Expandable answers
* Tips panel

---

## 🔍 5.3 AI Transparency Layer (IMPORTANT)

To make system “feel intelligent”:

### Show:

* how resume was parsed
* how job was interpreted
* how match score was computed

Example:

* 24 skills extracted
* 18 job requirements identified
* 72% semantic similarity
* 5 skill gaps detected

---

## ⚙️ 6. System Architecture

### High-Level Flow:

```id="9l7q3m"
User Input
   ↓
Resume Agent
   ↓
Job Agent
   ↓
Matching Agent
   ↓
Planner Agent
   ↓
UI Rendering Layer
```

---

### Optional Advanced Version:

* Orchestrator Agent controls workflow
* Each agent runs independently
* Structured JSON passed between agents

---

## 🎨 7. UX Principles

* Make AI **visible, not hidden**
* Every score must have explanation
* Every suggestion must have reasoning
* Always show “why this matters”

---

## 🚧 8. Non-Goals (for MVP)

* Real job application submission
* LinkedIn scraping
* Live recruiter integration
* Fully automated hiring

---

## 📦 9. Tech Stack (Suggested)

### Frontend:

* React / Next.js
* TailwindCSS
* Framer Motion (animations)

### Backend:

* Node.js / Python (FastAPI)
* LLM API (OpenAI / equivalent)

### AI Layer:

* Prompt-based agents
* JSON structured outputs
* Optional vector embeddings for matching

---

## 🧪 10. MVP Scope (Hackathon Version)

Must have:

* Resume upload/input
* Job description input
* Multi-agent pipeline working
* Match score generation
* Skill gap output
* Roadmap generation
* Interview prep generation

Nice to have:

* Animated agent flow
* AI reasoning panel
* Progress visualization

---

## 🏆 11. Why This Wins Hackathons

Because it demonstrates:

* Multi-agent architecture (not just chatbot)
* Real-world use case (job hunting)
* Explainable AI (transparent reasoning)
* Strong UX storytelling
* End-to-end product thinking

---

## 🚀 12. Future Improvements

* Resume version tracking
* Auto-tailored resumes per job
* Chrome extension for LinkedIn
* Real-time job scraping
* Voice-based interview simulator

---

If you want next step, I can also generate:

🔥 system design diagram (clean architecture image spec)
🔥 actual system prompts for each agent
🔥 or a killer 2-minute demo script (this is what wins hackathons)

Just tell me 👍
