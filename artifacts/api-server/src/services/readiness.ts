/**
 * Commission Documents — production readiness.
 *
 * Two consumers share the exact same checks below, deliberately, so the
 * enforcement gate and the readiness report can never disagree:
 *   1. requireAiProviderReadyForProduction (routes/commissionDocuments.ts) —
 *      refuses upload/retry with 503 before any storage or AI call.
 *   2. GET .../documents/readiness (routes/commissionDocuments.ts) — a
 *      read-only status check for the frontend's Upload button.
 *
 * Nothing here ever returns a secret value, a connection string, or any
 * detail beyond a plain boolean plus a short, generic, non-identifying
 * reason string for the AI provider case (never the env var's name or
 * value, never which provider is/isn't configured).
 */
import { sql } from "drizzle-orm";
import { getCommissionOpsDb } from "../db/ops-connection";
import { isDocumentStorageAvailable } from "./commissionDocumentStorage";
import { isCommissionDocumentsEnabled } from "../config/featureFlags";

export interface AiProviderReadiness {
  ready: boolean;
  /** Set only when !ready. A generic, sanitized reason — never the
   * configured provider's name, the env var's name, or any secret value. */
  reason?: string;
}

/**
 * True only when this deployment could realistically be processing real
 * financial documents for real users — the one condition under which
 * MockProvider must never be used implicitly.
 */
function requiresRealAiProvider(): boolean {
  return process.env["NODE_ENV"] === "production";
}

/**
 * getAiProviderReadiness — the single source of truth for "is it safe to
 * extract a real document right now."
 *
 * Outside production (dev, test, CI): always ready — MockProvider is the
 * expected, correct default for fixtures and local development.
 *
 * In production: ready only when a real provider is explicitly configured
 * AND its credential is present. Never inspects or reveals which provider
 * is configured, only whether the combination is sufficient.
 */
export function getAiProviderReadiness(): AiProviderReadiness {
  if (!requiresRealAiProvider()) {
    return { ready: true };
  }
  const configured = (process.env["AI_PROVIDER"] ?? "mock").toLowerCase();
  if (configured !== "claude") {
    return { ready: false, reason: "No real AI provider is configured for production use." };
  }
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return { ready: false, reason: "The configured AI provider's credential is missing." };
  }
  return { ready: true };
}

const DB_PING_TIMEOUT_MS = 3000;

async function checkDatabaseReady(): Promise<boolean> {
  try {
    const db = getCommissionOpsDb();
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DB_PING_TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export interface CommissionDocumentsReadiness {
  featureEnabled: boolean;
  databaseReady: boolean;
  objectStorageReady: boolean;
  aiProviderReady: boolean;
}

/**
 * computeReadiness — read-only, side-effect-free (a SELECT 1 ping and a
 * storage-availability probe, nothing more). Never throws — any check that
 * fails to even run is reported as not-ready rather than propagating an
 * error to the caller.
 */
export async function computeReadiness(): Promise<CommissionDocumentsReadiness> {
  const featureEnabled = isCommissionDocumentsEnabled();
  const [databaseReady, objectStorageReady] = await Promise.all([
    checkDatabaseReady(),
    isDocumentStorageAvailable().catch(() => false),
  ]);
  const aiProviderReady = getAiProviderReadiness().ready;
  return { featureEnabled, databaseReady, objectStorageReady, aiProviderReady };
}
