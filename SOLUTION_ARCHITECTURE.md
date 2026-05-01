# CareerHive — Solution Architecture

## Executive Summary

CareerHive is an AI-powered career assistant that accepts a user's resume and a target job posting, then produces a match score, skill gap roadmap, resume improvement suggestions, and tailored interview preparation questions. It is structured as three independently deployable services — a Vanilla JS single-page application, a Node.js/Express REST API, and a Python/FastAPI multi-agent LLM pipeline — all hosted on Microsoft Azure and backed by Azure Cosmos DB and Azure OpenAI (GPT-4).

---

## 1. Technical Architecture

### 1.1 System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Frontend SPA  (Vite · Vanilla JS)             │  │
│  │                                                          │  │
│  │  Views                                                   │  │
│  │  ├── /analysis          Resume & job upload form         │  │
│  │  ├── /dashboard         Analysis history + filters       │  │
│  │  ├── /interview-prep    Saved interview role cards       │  │
│  │  ├── /interview-prep/:id  Expandable Q&A detail          │  │
│  │  └── /saved-analysis    Full report overlay modal        │  │
│  │                                                          │  │
│  │  State: localStorage (sessionId, roadmap, roles, cache)  │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────│──────────────────────────────────┘
                              │  HTTPS  REST/JSON + FormData
┌─────────────────────────────▼──────────────────────────────────┐
│                Backend API  (Node.js · Express 5)               │
│                                                                  │
│  Route modules                                                   │
│  ├── POST /analyze/extract       Resume text extraction          │
│  ├── POST /analyze/scrape        Job URL → plain text            │
│  ├── POST /analyze               Full analysis pipeline          │
│  ├── POST /analyze/enhance-resume  Resume enhancement            │
│  ├── GET  /history               Paginated analysis history      │
│  ├── GET  /history/:id           Single analysis record          │
│  ├── DELETE /history/:id         Remove record                   │
│  ├── GET  /jobs                  Browse live job listings        │
│  ├── POST /smoke/cosmos          DB connectivity test            │
│  └── GET  /health                Service health check            │
│                                                                  │
│  Services                                                        │
│  ├── resumeExtractor.js   pdf-parse / mammoth / UTF-8            │
│  ├── jobScraper.js        cheerio HTML stripper (10s timeout)    │
│  ├── orchestrator.js      Normalise + persist + delegate        │
│  ├── providerFactory.js   Runtime LLM provider selection         │
│  │   ├── mafProvider.js        → MAF Service (90s timeout)       │
│  │   └── fallbackProvider.js   Keyword regex (offline)           │
│  ├── skillCanonicalizer.js  Deduplicate & normalise skill names  │
│  └── cosmosStore.js        Dual-API Cosmos DB client             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Azure Cosmos DB  (jobpilot / analyses)                 │   │
│  │   NoSQL API  or  MongoDB API  (auto-detected)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────┬───────────────────────┘
                   │  HTTP (internal)      │  HTTPS
       ┌───────────▼────────┐   ┌──────────▼───────────────────┐
       │   MAF Service       │   │   The Muse API               │
       │  (Python · FastAPI) │   │   themuse.com/api/public/jobs│
       │                     │   │   Paginated job listings     │
       │  5-Stage Pipeline   │   └──────────────────────────────┘
       │  (Semantic Kernel)  │
       │  1. Resume Agent    │
       │  2. Job Agent       │
       │  3. Match Agent     │
       │  4. Plan Agent      │
       │  5. Interview Agent │
       └──────────┬──────────┘
                  │  HTTPS  Azure OpenAI REST
       ┌──────────▼──────────────────────────┐
       │   Azure OpenAI Service  (GPT-4)      │
       │   AZURE_OPENAI_ENDPOINT              │
       │   AZURE_OPENAI_DEPLOYMENT            │
       └──────────────────────────────────────┘
```

### 1.2 Component Descriptions

| Component | Responsibility | Key Interactions |
|-----------|---------------|-----------------|
| **Frontend SPA** | Renders all 5 views; manages client-side routing (History API); persists session state in `localStorage` | Calls Backend API over HTTPS |
| **Backend API** | Orchestrates the analysis flow; handles file uploads, HTML scraping, history CRUD, and job browsing | Calls MAF Service, Cosmos DB, and The Muse API |
| **Provider Factory** | Selects the active LLM provider at runtime via the `LLM_PROVIDER` environment variable | Delegates to MAF Provider or Fallback Provider |
| **MAF Service** | Runs a 5-stage sequential multi-agent pipeline using Microsoft Semantic Kernel | Calls Azure OpenAI for each stage |
| **Fallback Provider** | Provides offline keyword/regex-based analysis when the MAF Service is unavailable or disabled | Self-contained; no external calls |
| **Azure Cosmos DB** | Stores all analysis records with filtering by `sessionId`, score range, and date range | Read/written by Backend's `cosmosStore.js` |
| **Azure OpenAI (GPT-4)** | Powers all AI reasoning: skill extraction, matching, roadmap generation, interview Q&A | Called by MAF Service via Semantic Kernel |
| **The Muse API** | Supplies live job listings for the `/jobs` browse feature | Called by Backend's `jobs.js` route |

### 1.3 Key Data Flows

#### Resume Analysis Pipeline (primary path)

```
1. User uploads resume (PDF / DOCX / TXT)
        └─► POST /analyze/extract
                └─► pdf-parse / mammoth / UTF-8 decode
                        └─► { text } returned to frontend

2. User supplies job URL
        └─► POST /analyze/scrape
                └─► cheerio fetches URL, strips nav/header/footer/scripts
                        └─► { text } returned to frontend

3. Frontend sends { resume, job, sessionId }
        └─► POST /analyze
                └─► orchestrator.js selects provider
                        └─► mafProvider.js: POST /pipeline to MAF Service (90s timeout)
                                └─► Semantic Kernel runs 5 sequential agents:
                                        Agent 1 → resume skills + experience level
                                        Agent 2 → job title + required skills
                                        Agent 3 → match score (0–100), gaps, strengths
                                        Agent 4 → week-by-week roadmap + improvements
                                        Agent 5 → interview Q&A per skill gap
                        └─► Result normalised by skillCanonicalizer.js
                        └─► Saved async to Cosmos DB (non-blocking)
                        └─► Full result returned to frontend

4. Frontend renders:
        ├── Match score
        ├── Missing skills & strengths
        ├── Roadmap (checkable steps, persisted in localStorage)
        ├── Resume improvements
        └── Interview Q&A (saved as a role in localStorage)
```

#### History Retrieval

```
GET /history?sessionId=…&minScore=…&maxScore=…&dateRange=…
        └─► cosmosStore.getRecentAnalyses()
                └─► Parameterised Cosmos SQL query
                        WHERE sessionId = @sid
                          AND source = "analyze"
                          AND matchScore BETWEEN @min AND @max
                          AND createdAt >= @cutoff
                        ORDER BY createdAt DESC
```

#### Fallback Path (no AI)

```
LLM_PROVIDER=fallback
        └─► providerFactory selects fallbackProvider.js
                ├── Stage 1: Regex skill detection on resume text
                ├── Stage 2: Regex skill detection on job text + title parse
                ├── Stage 3: Set-overlap score (matched / total required × 100)
                └── Stage 4: Week-by-week plan generated from missing skill list
        (No network calls to MAF Service or Azure OpenAI)
```

---

## 2. Technologies

### 2.1 Languages & Runtimes

| Layer | Language | Standard |
|-------|----------|---------|
| Frontend | JavaScript | ES Modules (ESNext) |
| Backend API | JavaScript | CommonJS (Node.js) |
| MAF Service | Python | async/await (Python 3.x) |

### 2.2 Frameworks & Libraries

#### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Vite** | ^8.0.8 | Build tool and dev server |
| Vanilla JavaScript | — | No UI framework; all UI hand-built |
| CSS3 Custom Properties | — | Theming via `--primary`, `--bg`, `--accent`, etc. |
| Google Material Symbols | CDN | Icon font |
| Sora / Plus Jakarta Sans | Google Fonts | Typography |
| History API | Native | Client-side routing (pushState / replaceState) |
| `localStorage` | Native | Session ID, view state, interview roles, roadmap progress, resume cache |

#### Backend (Node.js)

| Package | Version | Purpose |
|---------|---------|---------|
| **Express** | ^5.2.1 | REST API framework |
| `multer` | ^2.0.2 | Multipart file upload (in-memory storage) |
| `pdf-parse` | ^1.1.1 | PDF → plain text |
| `mammoth` | ^1.9.0 | DOCX → plain text |
| `cheerio` | ^1.2.0 | HTML parsing for job URL scraping |
| `@azure/cosmos` | ^4.9.2 | Cosmos DB NoSQL API client |
| `mongodb` | ^5.9.2 | Cosmos DB MongoDB API client |
| `cors` | ^2.8.6 | CORS middleware |
| `dotenv` | ^17.4.2 | Environment variable loading |

#### MAF Service (Python)

| Package | Version | Purpose |
|---------|---------|---------|
| **FastAPI** | 0.115.5 | Async REST API framework |
| **Uvicorn** | 0.32.1 | ASGI server |
| **Semantic Kernel** | 1.17.1 | Microsoft multi-agent LLM orchestration |
| `httpx` | 0.27.2 | Async HTTP client |
| `python-dotenv` | 1.0.1 | Environment variable loading |

### 2.3 Data Store

| Service | Role | Details |
|---------|------|---------|
| **Azure Cosmos DB** | Primary persistence | Database: `jobpilot`, Container: `analyses` |
| | | Dual-API: NoSQL (AccountEndpoint connection string) or MongoDB (mongodb:// connection string), auto-detected at runtime |
| | | Operations: save, query with filters, fetch by ID, delete by ID |
| `localStorage` (browser) | Client-side persistence | Session ID, roadmap completion, saved interview roles, resume text cache, active view |

### 2.4 Cloud & Infrastructure

| Service | Purpose |
|---------|---------|
| **Azure Static Web Apps** | Frontend SPA hosting with global CDN; SPA rewrite rules via `staticwebapp.config.json` |
| **Azure App Service** | Hosts Backend API (Node.js) and MAF Service (Python) |
| **Azure OpenAI** | GPT-4 deployment; consumed by Semantic Kernel in MAF Service |
| **GitHub Actions** | CI/CD pipelines (3 workflows: frontend, backend, MAF service) |

### 2.5 Key Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `COSMOS_CONNECTION_STRING` | Backend | Cosmos DB connection (NoSQL or MongoDB) |
| `COSMOS_DB_NAME` | Backend | Database name (default: `jobpilot`) |
| `COSMOS_CONTAINER_NAME` | Backend | Container name (default: `analyses`) |
| `MAF_SERVICE_URL` | Backend | Internal URL of the MAF Service |
| `LLM_PROVIDER` | Backend | `"maf"` or `"fallback"` |
| `MUSE_API_KEY` | Backend | The Muse API key for job listings |
| `AZURE_OPENAI_ENDPOINT` | MAF Service | Azure OpenAI service URL |
| `AZURE_OPENAI_API_KEY` | MAF Service | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | MAF Service | Model deployment name (e.g., `gpt-4`) |
| `AZURE_OPENAI_API_VERSION` | MAF Service | API version (default: `2024-12-01-preview`) |
| `VITE_API_URL` | Frontend | Backend API base URL |

---

## 3. Scalability

### 3.1 Design Principles Supporting Scale

- **Stateless services:** Neither the Backend API nor the MAF Service holds in-memory state between requests. Session identity is a client-supplied `sessionId` string. Any number of service instances can handle any request without affinity.
- **Independently deployable services:** Each of the three services can be scaled, deployed, and rolled back independently.
- **Client-owned state:** All user-specific ephemeral data (roadmap progress, saved interview roles, resume cache) lives in `localStorage`. The server only stores durable analysis records.
- **Async persistence:** Analysis results are saved to Cosmos DB asynchronously and non-blocking — a DB write failure never delays the API response to the user.
- **Built-in degraded mode:** The Fallback Provider allows the system to continue serving analysis results (without AI) if Azure OpenAI is unavailable or rate-limited.

### 3.2 Scalability per Layer

#### Frontend — Azure Static Web Apps (CDN)
- Static assets distributed globally via Azure CDN — no server required.
- Zero marginal cost per additional user; already scales to unlimited concurrent users.
- No server-side sessions; horizontal scale is implicit.

#### Backend API — Azure App Service (Node.js)
- **Horizontal scaling:** Stateless design allows running N instances behind an Azure Load Balancer with no session affinity.
- **File upload bottleneck:** `multer` stores uploaded files in memory. Under high concurrency this increases per-process RAM. Mitigation: stream uploads directly to Azure Blob Storage instead of buffering in-process.
- **Long-connection bottleneck:** The `POST /analyze` route holds an HTTP connection open for up to 90 seconds waiting for the MAF Service. Under load this exhausts connection pool slots. Mitigation: introduce an async job queue (Azure Service Bus) — the client submits a job, polls for results, and the backend worker processes without holding a connection.
- **Scraping:** `cheerio`-based job URL scraping is CPU-light and stateless; scales linearly.

#### MAF Service — Azure App Service (Python/FastAPI)
- **Horizontal scaling:** FastAPI + Uvicorn is async; each instance handles concurrent requests via Python's event loop. Deploy multiple instances behind Azure Load Balancer.
- **Pipeline parallelism:** Each individual analysis pipeline is sequential (5 agents in order). Requests are independent of each other and can execute concurrently across instances.
- **Azure OpenAI rate limit bottleneck:** Each pipeline stage makes one or more calls to Azure OpenAI. TPM (tokens per minute) and RPM (requests per minute) quotas are the primary throughput ceiling.
  - Mitigation options:
    1. **PTU (Provisioned Throughput Units):** Reserve dedicated capacity.
    2. **Multiple deployments:** Round-robin across several GPT-4 deployments.
    3. **Semantic Kernel retry/back-off:** Already supported by SK's built-in retry policies.

#### Database — Azure Cosmos DB
- **Auto-scale RU/s:** Cosmos DB in auto-scale mode adjusts throughput up and down automatically.
- **Partitioning:** Queries are always filtered by `sessionId`. Setting the container partition key to `/sessionId` ensures all queries land on a single logical partition, eliminating cross-partition fan-out.
- **Global distribution:** If the product expands internationally, Cosmos DB supports multi-region write replicas with configurable consistency levels.
- **Recommendation:** Enable TTL (Time To Live) on the `analyses` container to auto-expire old records and manage storage cost as data volume grows.

#### AI Layer — Azure OpenAI
- **Current model:** GPT-4 (configured via `AZURE_OPENAI_DEPLOYMENT`).
- **Throughput ceiling:** TPM/RPM quota per deployment.
- **Scale options:** Increase quota, add PTU, or route to multiple regional deployments.
- **Graceful degradation:** `LLM_PROVIDER=fallback` allows the product to serve a degraded but functional experience at zero AI cost during quota exhaustion or outages.

### 3.3 Scalability Summary

| Component | Scaling Mechanism | Primary Bottleneck | Recommended Mitigation |
|-----------|------------------|-------------------|----------------------|
| **Frontend** | Global CDN (infinite) | None | Already at scale |
| **Backend API** | Horizontal (stateless, N instances) | Long-held MAF connections; in-memory file buffers | Async job queue (Azure Service Bus); stream uploads to Blob Storage |
| **MAF Service** | Horizontal (stateless async, N instances) | Azure OpenAI TPM/RPM quotas | PTU reservation; multi-deployment round-robin |
| **Cosmos DB** | Auto-scale RU/s; multi-region | Cross-partition queries | Set partition key to `/sessionId`; enable TTL |
| **Azure OpenAI** | Quota increases; PTU | TPM/RPM per deployment | PTU or additional regional deployments |
| **Fallback Provider** | In-process (no I/O) | CPU (regex on large texts) | Scale Backend API instances |
