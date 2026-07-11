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
// table.sql relative to the bundle), so we create the "session" table ourselves.
//
// DATABASE_URL is the Dashboard's own operational database, which is separate
// from FinanceOS Core (Core is read-only via CORE_DATABASE_URL). The Dashboard
// owns this database with full privileges, so creating the "session" table
// succeeds. Any failure here (bad DATABASE_URL, network/TLS outage, missing
// privileges) is a real problem and must fail startup loudly — there is no
// in-memory fallback.
export async function ensureSessionTable(): Promise<void> {
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
}

// The session middleware is initialized at startup once the "session" table is
// ensured. Until initSession() runs this delegate is a no-op passthrough;
// index.ts awaits initSession() before it starts listening, so no real request
// is served before the PostgreSQL-backed store is ready.
let sessionMiddleware: express.RequestHandler = (_req, _res, next) => next();

export async function initSession(): Promise<void> {
  await ensureSessionTable();
  sessionMiddleware = session({
    store: new PgSession({ pool: sessionPool, tableName: "session" }),
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

// Server-side sessions, backed by PostgreSQL (connect-pg-simple) on the
// Dashboard's operational database. initSession() wires up the store at startup;
// this delegate forwards to it.
app.use((req, res, next) => sessionMiddleware(req, res, next));

app.use("/api", router);

export default app;
