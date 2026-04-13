const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const crypto = require("crypto");
const { CosmosClient } = require("@azure/cosmos");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 5000;
const COSMOS_CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING;
const COSMOS_DB_NAME = process.env.COSMOS_DB_NAME || "jobpilot";
const COSMOS_CONTAINER_NAME = process.env.COSMOS_CONTAINER_NAME || "analyses";

function requireEnv(name, value) {
if (!value) {
throw new Error("Missing required env: " + name);
}
}

requireEnv("COSMOS_CONNECTION_STRING", COSMOS_CONNECTION_STRING);

const cosmosClient = new CosmosClient(COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(COSMOS_DB_NAME);
const container = database.container(COSMOS_CONTAINER_NAME);

app.get("/health", (req, res) => {
res.json({
status: "ok",
service: "jobmatch-backend",
time: new Date().toISOString()
});
});

app.post("/smoke/cosmos", async (req, res) => {
try {
const id = crypto.randomUUID();
const sessionId = req.body?.sessionId || "demo-session";
const createdAt = new Date().toISOString();

const doc = {
id,
sessionId,
createdAt,
source: "smoke-test"
};

await container.items.create(doc);
const { resource } = await container.item(id, sessionId).read();

res.json({
write: true,
read: !!resource,
id,
sessionId
});
} catch (err) {
res.status(500).json({
write: false,
read: false,
error: err.message
});
}
});

app.post("/analyze", async (req, res) => {
try {
const resume = (req.body?.resume || "").trim();
const job = (req.body?.job || "").trim();

if (!resume || !job) {
return res.status(400).json({
error: "resume and job are required"
});
}

const id = crypto.randomUUID();
const sessionId = req.body?.sessionId || "demo-session";
const createdAt = new Date().toISOString();

const responsePayload = {
resume: { skills: ["React", "Node"] },
job: { skills: ["React", "AWS", "GraphQL"] },
match: {
score: 72,
missing_skills: ["AWS", "GraphQL"]
},
plan: {
roadmap: ["Learn AWS basics", "Build a GraphQL API project"]
}
};

const doc = {
id,
sessionId,
createdAt,
resumeSnippet: resume.slice(0, 200),
jobSnippet: job.slice(0, 200),
matchScore: responsePayload.match.score,
missingSkills: responsePayload.match.missing_skills,
roadmap: responsePayload.plan.roadmap,
provider: "deterministic",
source: "analyze-smoke"
};

await container.items.create(doc);

res.json(responsePayload);
} catch (err) {
res.status(500).json({
error: "analyze_failed",
message: err.message
});
}
});

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});