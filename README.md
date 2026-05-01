# CareerHive

CareerHive is an AI-powered career assistant platform designed to bridge the gap between job seekers and their ideal roles. By leveraging advanced natural language processing and a multi-agent framework, CareerHive analyzes resumes, discovers matching job opportunities, provides targeted interview preparation, and offers actionable resume enhancements.

## ☁️ Azure Services Leveraged

CareerHive is deeply integrated with the Microsoft Azure ecosystem to achieve robust scalability, performance, and advanced AI capabilities:

* **Azure Static Web Apps (SWA)**: Hosts the frontend Vite application. The `staticwebapp.config.json` is natively configured to handle SPA routing, seamlessly deploying the client-side UI on global Azure infrastructure.
* **Azure Foundry OpenAI**: The brain behind the application. It powers all the sophisticated reasoning, natural language parsing, and conversational agents used across the pipeline (via Semantic Kernel), running securely inside Azure boundaries.
* **Azure Cosmos DB**: Used as our high-performance, globally distributed database for saving user session histories and analysis results. The backend dynamically supports connecting via both the **Cosmos DB NoSQL API** and **Cosmos DB for MongoDB API**.
* **Azure App Service / Container Apps (Target)**: While running locally today, the Node.js backend and Python MAF service are container/PaaS-ready for hosting environments like Azure App Service.

## 🔌 Third-Party Integrations

* **Document Parsing**: Incorporates **Mammoth** (`.docx`) and **pdf-parse** (`.pdf`) via Multer to safely and accurately handle direct resume uploads.
* **Job Intelligence**: Harvests rich, live job data using **The Muse API** and couples it with **Cheerio** internally to scrape the deep semantic context of related HTML job detail pages.

## 🏗 System Architecture

The project is structured into three primary components:

### 1. Frontend
A fast, lightweight, and responsive user interface built with Vite, Vanilla JavaScript, HTML, and CSS. 
* Designed to be deployed as an **Azure Static Web App** (`staticwebapp.config.json`).
* Provides users with a seamless interface to upload resumes, find related job listings, and view detailed match analytics.

### 2. Backend (Node.js/Express)
The core API and orchestration layer, responsible for routing requests, managing data, and interfacing with the Python AI service.

**Key Routes:**
* `POST /analyze` - Triggers the core pipeline.
  * `/analyze/extract`: Accepts document uploads (in-memory) and automatically parses PDF and DOCX files.
  * `/analyze/scrape`: Extracts full job description contents from specific job URLs.
  * `/analyze/enhance-resume`: Suggests actionable updates for resume content based on missing strengths and improvements.
* `GET /history` - Retrieves past session insights.
* `GET /jobs` - Discovers and curates job listings by job role via direct API queries.
* `GET /smoke` - Validates the health and connectivity of Azure integrations.

### 3. MAF Service (Multi-Agent Framework)
A Python-based FastAPI microservice using **Semantic Kernel** to establish an intricate AI pipeline for reasoning tasks.
* **Pipeline Agents**: Segregates processes into sequential agents (`extract_resume`, `extract_job`, `analyze_combined`, and `enhance_resume`).
* Executed via standard HTTP triggers from the Node.js backend (`/pipeline` and `/enhance-resume` routes) as an advanced orchestration engine.

## 🚀 Key Features & Pipeline Steps

The system features a rigorous 5-step evaluation pipeline for candidates:
1. **Extract**: Automatically grabs canonical skills, experiences, and metrics from parsed resume representations and extracts criteria requirements from job postings.
2. **Match**: Maps the generated profile text against the target job requirements to calculate similarities, strengths, and identify missing gap skills.
3. **Plan**: Formulates customized short-term career roadmaps depending on the candidate's specific background and the job's expectations.
4. **Interview Guidance**: Prepares the user with highly tailored technical and behavioral interview questions mapped against their specific weak points.
5. **Enhance Resume**: Generates concrete rewrite suggestions targeting the specific job domain.

## 🛠 Getting Started

### Prerequisites
* Node.js v18+
* Python 3.10+
* Active Azure Subscription with Azure OpenAI deployments and a Cosmos DB instance available.

### Installation
1. **Backend**: Navigate to `/backend`, run `npm install`. Add your `.env` containing `COSMOS_CONNECTION_STRING` and `MUSE_API_KEY`. Start via `npm run dev`.
2. **MAF Service**: Navigate to `/maf-service`. Define `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` in a `.env`. Setup Python dependencies via `pip install -r requirements.txt`, and boot the app using `sh startup.sh`.
3. **Frontend**: Move to the `/frontend` directory, install packages with `npm install`, and serve it locally with `npm run dev`.