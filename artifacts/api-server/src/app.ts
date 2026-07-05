import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import router from "./routes";
import { logger } from "./lib/logger";

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required but was not provided.");
}

const PgSession = connectPgSimple(session);
const sessionPool = new Pool({ connectionString: databaseUrl });

// The bundled build breaks connect-pg-simple's createTableIfMissing (it reads
// table.sql relative to the bundle), so we create the table ourselves.
//
// The Neon database is owned by the upstream "Core" service and the dashboard
// connects with a read-scoped role that has USAGE but not CREATE on the public
// schema, so this DDL fails with "permission denied for schema public". When
// that happens we fall back to express-session's in-memory store so the server
// still boots. Sessions then live in memory (lost on restart) — provisioning a
// persistent "session" table on Neon with the right grants is a Sprint 6 item.
export async function ensureSessionTable(): Promise<boolean> {
  try {
    await sessionPool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);
    await sessionPool.query(
      `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`,
    );
    return true;
  } catch (err) {
    // Only tolerate the specific "insufficient privilege" failure (Postgres
    // SQLSTATE 42501) that the read-scoped Neon role produces. Any other error
    // (bad DATABASE_URL, network/TLS outage, etc.) is a real problem that must
    // not be silently downgraded to ephemeral in-memory sessions, so re-throw
    // it and let startup fail loudly.
    const code = (err as { code?: unknown } | null)?.code;
    if (code !== "42501") {
      throw err;
    }
    logger.warn(
      { err },
      "Could not create the PostgreSQL session table: the Neon role lacks CREATE on schema public. Falling back to an in-memory session store — sessions will not persist across restarts or scale across instances. Provisioning a persistent session table on Neon is a follow-up (Sprint 6) item.",
    );
    return false;
  }
}

// The session middleware is chosen at startup: PostgreSQL-backed when the table
// is available, otherwise the default in-memory store. Until initSession() runs
// this delegate is a no-op passthrough; index.ts awaits initSession() before it
// starts listening, so no real request is served before the store is chosen.
let sessionMiddleware: express.RequestHandler = (_req, _res, next) => next();

export async function initSession(): Promise<void> {
  const hasTable = await ensureSessionTable();
  sessionMiddleware = session({
    ...(hasTable
      ? { store: new PgSession({ pool: sessionPool, tableName: "session" }) }
      : {}),
    secret: sessionSecret as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server-side sessions. The concrete store (PostgreSQL via connect-pg-simple or
// the in-memory fallback) is selected by initSession() at startup; this delegate
// forwards to whichever middleware was chosen.
app.use((req, res, next) => sessionMiddleware(req, res, next));

app.use("/api", router);

export default app;
