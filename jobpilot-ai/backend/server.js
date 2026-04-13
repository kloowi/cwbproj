require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./src/routes/analyze");
const historyRouter = require("./src/routes/history");
const smokeRouter = require("./src/routes/smoke");
const { getCosmosStatus } = require("./src/services/cosmosStore");

const app = express();
const port = Number(process.env.PORT || 5050);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
	res.json({
		ok: true,
		service: "jobpilot-backend",
		time: new Date().toISOString(),
		cosmos: getCosmosStatus()
	});
});

app.use("/smoke", smokeRouter);
app.use("/analyze", analyzeRouter);
app.use("/history", historyRouter);

app.use((err, _req, res, _next) => {
	console.error("Unhandled error", err);
	res.status(500).json({
		error: "Internal server error"
	});
});

app.listen(port, () => {
	console.log(`JobPilot backend running on ${port}`);
});