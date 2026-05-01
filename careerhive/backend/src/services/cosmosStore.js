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

async function saveAnalysisRecord({ id: providedId, sessionId, resume, job, result }) {
  const id = providedId || crypto.randomUUID();
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
    improvements: Array.isArray(result?.plan?.improvements) ? result.plan.improvements : [],
    interviewQuestions: Array.isArray(result?.interview?.questions)
      ? result.interview.questions
        .map((item) => ({
          prompt: String(item?.prompt || "").trim(),
          answer: String(item?.answer || "").trim(),
          focusSkill: String(item?.focusSkill || item?.focus_skill || "").trim()
        }))
        .filter((item) => item.prompt && item.answer)
        .slice(0, 4)
      : [],
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

function normalizeHistoryFilters(filters) {
  const input = filters && typeof filters === "object" ? filters : {};
  const minScoreRaw = Number(input.minScore);
  const maxScoreRaw = Number(input.maxScore);
  const minScore = Number.isFinite(minScoreRaw) ? Math.max(0, Math.min(100, minScoreRaw)) : null;
  const maxScore = Number.isFinite(maxScoreRaw) ? Math.max(0, Math.min(100, maxScoreRaw)) : null;
  const dateRange = String(input.dateRange || "all").toLowerCase();

  let sinceIso = null;
  if (dateRange === "7d") {
    sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (dateRange === "30d") {
    sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    minScore,
    maxScore,
    sinceIso
  };
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
      resumeSnippet: row.resumeSnippet || "",
      jobSnippet: row.jobSnippet || "",
      matchScore: Number(row.matchScore || 0),
      matchReasoning: row.matchReasoning || "",
      missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
      strengths: Array.isArray(row.strengths) ? row.strengths : [],
      roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
      improvements: Array.isArray(row.improvements) ? row.improvements : [],
      interviewQuestions: Array.isArray(row.interviewQuestions) ? row.interviewQuestions : [],
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
        ? "SELECT TOP 1 c.id, c.sessionId, c.createdAt, c.jobTitle, c.resumeSnippet, c.jobSnippet, c.matchScore, c.matchReasoning, c.missingSkills, c.strengths, c.roadmap, c.improvements, c.interviewQuestions, c.provider FROM c WHERE c.source = @source AND c.id = @id AND c.sessionId = @sessionId"
        : "SELECT TOP 1 c.id, c.sessionId, c.createdAt, c.jobTitle, c.resumeSnippet, c.jobSnippet, c.matchScore, c.matchReasoning, c.missingSkills, c.strengths, c.roadmap, c.improvements, c.interviewQuestions, c.provider FROM c WHERE c.source = @source AND c.id = @id",
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
    resumeSnippet: row.resumeSnippet || "",
    jobSnippet: row.jobSnippet || "",
    matchScore: Number(row.matchScore || 0),
    matchReasoning: row.matchReasoning || "",
    missingSkills: Array.isArray(row.missingSkills) ? row.missingSkills : [],
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    roadmap: Array.isArray(row.roadmap) ? row.roadmap : [],
    improvements: Array.isArray(row.improvements) ? row.improvements : [],
    interviewQuestions: Array.isArray(row.interviewQuestions) ? row.interviewQuestions : [],
    provider: row.provider || "unknown"
  };
}

async function getRecentAnalyses(sessionId, limit = null, filters = {}) {
  const apiType = detectApiType(COSMOS_CONNECTION_STRING);
  const numericLimit = Number(limit);
  const safeLimit = Number.isFinite(numericLimit) && numericLimit > 0 ? Math.floor(numericLimit) : null;
  const normalizedFilters = normalizeHistoryFilters(filters);

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    const query = sessionId ? { sessionId, source: "analyze" } : { source: "analyze" };

    if (normalizedFilters.minScore !== null || normalizedFilters.maxScore !== null) {
      query.matchScore = {};
      if (normalizedFilters.minScore !== null) query.matchScore.$gte = normalizedFilters.minScore;
      if (normalizedFilters.maxScore !== null) query.matchScore.$lte = normalizedFilters.maxScore;
    }

    if (normalizedFilters.sinceIso) {
      query.createdAt = { $gte: normalizedFilters.sinceIso };
    }

    let cursor = collection.find(query).sort({ createdAt: -1 });
    if (safeLimit !== null) {
      cursor = cursor.limit(safeLimit);
    }
    const rows = await cursor.toArray();

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
  const whereClauses = ["c.source = @source"];
  const parameters = [{ name: "@source", value: "analyze" }];

  if (sessionId) {
    whereClauses.push("c.sessionId = @sessionId");
    parameters.push({ name: "@sessionId", value: sessionId });
  }

  if (normalizedFilters.minScore !== null) {
    whereClauses.push("c.matchScore >= @minScore");
    parameters.push({ name: "@minScore", value: normalizedFilters.minScore });
  }

  if (normalizedFilters.maxScore !== null) {
    whereClauses.push("c.matchScore <= @maxScore");
    parameters.push({ name: "@maxScore", value: normalizedFilters.maxScore });
  }

  if (normalizedFilters.sinceIso) {
    whereClauses.push("c.createdAt >= @sinceIso");
    parameters.push({ name: "@sinceIso", value: normalizedFilters.sinceIso });
  }

  const selectFields = "c.id, c.sessionId, c.createdAt, c.jobTitle, c.jobSnippet, c.matchScore, c.missingSkills, c.roadmap, c.improvements, c.provider";
  if (safeLimit !== null) {
    parameters.push({ name: "@limit", value: safeLimit });
  }

  const querySpec = {
    query: `${safeLimit !== null ? "SELECT TOP @limit" : "SELECT"} ${selectFields} FROM c WHERE ${whereClauses.join(" AND ")} ORDER BY c.createdAt DESC`,
    parameters
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
    improvements: Array.isArray(row.improvements) ? row.improvements : [],
    provider: row.provider || "unknown"
  }));
}

async function deleteAnalysisById(id, sessionId) {
  const cleanId = String(id || "").trim();
  const cleanSessionId = String(sessionId || "").trim();
  if (!cleanId || !cleanSessionId) return false;

  const apiType = detectApiType(COSMOS_CONNECTION_STRING);

  if (apiType === "mongo") {
    const collection = await getMongoCollection();
    const result = await collection.deleteOne({ _id: cleanId, sessionId: cleanSessionId, source: "analyze" });
    return result.deletedCount > 0;
  }

  const dbContainer = getContainer();

  try {
    const { resource } = await dbContainer.item(cleanId, cleanSessionId).read();
    if (!resource || resource.source !== "analyze") return false;
    await dbContainer.item(cleanId, cleanSessionId).delete();
    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = {
  getCosmosStatus,
  runSmokeTest,
  saveAnalysisRecord,
  getRecentAnalyses,
  getAnalysisById,
  deleteAnalysisById
};
