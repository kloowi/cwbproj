const crypto = require("crypto");
const { CosmosClient } = require("@azure/cosmos");
const { MongoClient } = require("mongodb");

const COSMOS_CONNECTION_STRING = process.env.COSMOS_CONNECTION_STRING;
const COSMOS_DB_NAME = process.env.COSMOS_DB_NAME || "jobpilot";
const COSMOS_CONTAINER_NAME = process.env.COSMOS_CONTAINER_NAME || "analyses";

let container;
let mongoCollection;

function detectApiType(connectionString) {
  if (!connectionString) return "none";
  if (connectionString.startsWith("mongodb")) return "mongo";
  if (connectionString.includes("AccountEndpoint=") && connectionString.includes("AccountKey=")) {
    return "nosql";
  }

  return "unknown";
}

function getCosmosStatus() {
  return {
    enabled: Boolean(COSMOS_CONNECTION_STRING),
    api: detectApiType(COSMOS_CONNECTION_STRING),
    database: COSMOS_DB_NAME,
    container: COSMOS_CONTAINER_NAME
  };
}

function assertConnectionString() {
  if (!COSMOS_CONNECTION_STRING || !COSMOS_CONNECTION_STRING.trim()) {
    throw new Error("COSMOS_CONNECTION_STRING is missing.");
  }
}

function getContainer() {
  assertConnectionString();

  if (!container) {
    const cosmosClient = new CosmosClient(COSMOS_CONNECTION_STRING);
    const database = cosmosClient.database(COSMOS_DB_NAME);
    container = database.container(COSMOS_CONTAINER_NAME);
  }

  return container;
}

async function getMongoCollection() {
  assertConnectionString();

  if (!mongoCollection) {
    const mongoClient = new MongoClient(COSMOS_CONNECTION_STRING);
    await mongoClient.connect();
    mongoCollection = mongoClient.db(COSMOS_DB_NAME).collection(COSMOS_CONTAINER_NAME);
  }

  return mongoCollection;
}

async function runSmokeTest(sessionId = "demo-session") {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const apiType = detectApiType(COSMOS_CONNECTION_STRING);

  const doc = {
    id,
    sessionId,
    createdAt,
    source: "smoke-test"
  };

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    await collection.insertOne({ ...doc, _id: id });
    const resource = await collection.findOne({ _id: id, sessionId });

    return {
      write: true,
      read: Boolean(resource),
      id,
      sessionId
    };
  }

  const dbContainer = getContainer();
  await dbContainer.items.create(doc);
  const { resource } = await dbContainer.item(id, sessionId).read();

  return {
    write: true,
    read: Boolean(resource),
    id,
    sessionId
  };
}

async function saveAnalysisRecord({ sessionId, resume, job, result }) {
  const id = crypto.randomUUID();
  const apiType = detectApiType(COSMOS_CONNECTION_STRING);

  const doc = {
    id,
    sessionId,
    createdAt: new Date().toISOString(),
    source: "analyze",
    resumeSnippet: resume.slice(0, 250),
    jobSnippet: job.slice(0, 250),
    jobTitle: String(result?.job?.title || "").trim().slice(0, 120),
    matchScore: Number(result?.match?.score || 0),
    matchReasoning: String(result?.match?.reasoning || "").trim().slice(0, 500),
    missingSkills: Array.isArray(result?.match?.missing) ? result.match.missing : [],
    strengths: Array.isArray(result?.match?.strengths) ? result.match.strengths : [],
    roadmap: Array.isArray(result?.plan?.roadmap) ? result.plan.roadmap : [],
    provider: result?.meta?.provider || "unknown"
  };

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    await collection.insertOne({ ...doc, _id: id });
    return { id, sessionId };
  }

  const dbContainer = getContainer();
  await dbContainer.items.create(doc);
  return { id, sessionId };
}

async function getAnalysisById(id, sessionId) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return null;

  const apiType = detectApiType(COSMOS_CONNECTION_STRING);

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    const query = sessionId
      ? { _id: cleanId, sessionId, source: "analyze" }
      : { _id: cleanId, source: "analyze" };
    const row = await collection.findOne(query);
    if (!row) return null;

    return {
      id: row.id || row._id,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
      jobTitle: row.jobTitle || "",
      matchScore: Number(row.matchScore || 0),
      matchReasoning: row.matchReasoning || "",
      missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
      strengths: Array.isArray(row.strengths) ? row.strengths : [],
      roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
      provider: row.provider || "unknown"
    };
  }

  const dbContainer = getContainer();
  let row = null;

  if (sessionId) {
    try {
      const { resource } = await dbContainer.item(cleanId, sessionId).read();
      row = resource;
    } catch (_error) {
      row = null;
    }
  }

  if (!row) {
    const querySpec = {
      query: sessionId
        ? "SELECT TOP 1 c.id, c.sessionId, c.createdAt, c.jobTitle, c.matchScore, c.matchReasoning, c.missingSkills, c.strengths, c.roadmap, c.provider FROM c WHERE c.source = @source AND c.id = @id AND c.sessionId = @sessionId"
        : "SELECT TOP 1 c.id, c.sessionId, c.createdAt, c.jobTitle, c.matchScore, c.matchReasoning, c.missingSkills, c.strengths, c.roadmap, c.provider FROM c WHERE c.source = @source AND c.id = @id",
      parameters: sessionId
        ? [
            { name: "@source", value: "analyze" },
            { name: "@id", value: cleanId },
            { name: "@sessionId", value: sessionId }
          ]
        : [
            { name: "@source", value: "analyze" },
            { name: "@id", value: cleanId }
          ]
    };

    const { resources } = await dbContainer.items.query(querySpec).fetchAll();
    row = resources[0] || null;
  }

  if (!row || row.source && row.source !== "analyze") return null;

  return {
    id: row.id,
    sessionId: row.sessionId,
    createdAt: row.createdAt,
    jobTitle: row.jobTitle || "",
    matchScore: Number(row.matchScore || 0),
    matchReasoning: row.matchReasoning || "",
    missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
    provider: row.provider || "unknown"
  };
}

async function getRecentAnalyses(sessionId, limit = 5) {
  const apiType = detectApiType(COSMOS_CONNECTION_STRING);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    const query = sessionId ? { sessionId, source: "analyze" } : { source: "analyze" };
    const rows = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .toArray();

    return rows.map((row) => ({
      id: row.id || row._id,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
      jobTitle: row.jobTitle || "",
      jobSnippet: row.jobSnippet || "",
      matchScore: Number(row.matchScore || 0),
      missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
      roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
      provider: row.provider || "unknown"
    }));
  }

  const dbContainer = getContainer();
  const querySpec = {
    query: sessionId
      ? "SELECT TOP @limit c.id, c.sessionId, c.createdAt, c.jobTitle, c.jobSnippet, c.matchScore, c.missingSkills, c.roadmap, c.provider FROM c WHERE c.source = @source AND c.sessionId = @sessionId ORDER BY c.createdAt DESC"
      : "SELECT TOP @limit c.id, c.sessionId, c.createdAt, c.jobTitle, c.jobSnippet, c.matchScore, c.missingSkills, c.roadmap, c.provider FROM c WHERE c.source = @source ORDER BY c.createdAt DESC",
    parameters: sessionId
      ? [
          { name: "@limit", value: safeLimit },
          { name: "@source", value: "analyze" },
          { name: "@sessionId", value: sessionId }
        ]
      : [
          { name: "@limit", value: safeLimit },
          { name: "@source", value: "analyze" }
        ]
  };

  const { resources } = await dbContainer.items.query(querySpec).fetchAll();
  return resources.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    createdAt: row.createdAt,
    jobTitle: row.jobTitle || "",
    jobSnippet: row.jobSnippet || "",
    matchScore: Number(row.matchScore || 0),
    missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
    roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
    provider: row.provider || "unknown"
  }));
}

module.exports = {
  getCosmosStatus,
  runSmokeTest,
  saveAnalysisRecord,
  getRecentAnalyses,
  getAnalysisById
};
