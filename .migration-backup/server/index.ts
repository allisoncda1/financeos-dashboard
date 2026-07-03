import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import healthRouter     from "./routes/health.js";
import entitiesRouter   from "./routes/entities.js";
import modelRouter      from "./routes/model.js";
import validationRouter from "./routes/validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── CORS — dev: allow Vite on 3000; prod: same origin ────────────────────────
app.use(cors({
  origin: IS_PROD
    ? false
    : ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/health",     healthRouter);
app.use("/api/entities",   entitiesRouter);
app.use("/api/model",      modelRouter);
app.use("/api/validation", validationRouter);

// ── Production: serve built Vite bundle ───────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── 404 for unknown /api routes ───────────────────────────────────────────────
app.use("/api/*", (_req, res) => {
  res.status(404).json({ ok: false, error: "API route not found", ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] FinanceOS API running on http://localhost:${PORT}`);
  console.log(`[server] Mode: ${IS_PROD ? "production" : "development"}`);
});

export default app;
