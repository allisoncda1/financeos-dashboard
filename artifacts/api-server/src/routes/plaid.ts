/**
 * Plaid routes — Production hardening (Phase 2).
 *
 * DATABASE_URL (heliumdb) ONLY — never the core analytics database.
 * PLAID_TOKEN_ENCRYPTION_KEY encrypts access_tokens at rest (AES-256-GCM).
 *
 * SECURITY INVARIANTS:
 *  - access_token is encrypted immediately after exchange; plaintext is never logged or returned.
 *  - No response schema ever includes access_token, iv, tag, or encryption key.
 *  - Webhook route uses express.raw() — raw body required for JOSE ES256 signature verification.
 *  - Webhook verification is mandatory in production: unverified requests return 401.
 *  - POST /plaid/link-token requires existing, non-withdrawn consent record.
 *  - POST /plaid/consent persists to plaid_consent_records; duplicates are deduplicated.
 *  - canManageBanking (admin | cfo) gates link-token, exchange-token, sync, disconnect.
 *  - canViewBanking (banking permission) gates accounts, transactions, connections, consent-info.
 *
 * Two routers are exported:
 *  - default export `plaidRouter`        — authenticated routes, mount after requireAuth
 *  - named export  `plaidWebhookRouter`  — public route, mount before requireAuth
 */

import { Router } from "express";
import { Pool } from "pg";
import { CountryCode, Products } from "plaid";
import crypto from "crypto";
import { importJWK, jwtVerify, decodeProtectedHeader } from "jose";
import { plaidClient } from "../lib/plaidClient.js";
import { encryptAccessToken, decryptAccessToken } from "../lib/plaidEncryption.js";
import { validateEntitySlug } from "../lib/plaidEntityValidation.js";
import { requireAuth } from "../auth/middleware.js";
import { requirePermission, hasPermission } from "../auth/permissions.js";
import type { AuthUser } from "../auth/types.js";
import {
  PLAID_CONSENT_TEXT,
  CURRENT_PRIVACY_POLICY_VERSION,
  consentTextHash,
  buildConsentRecord,
} from "../services/consentService.js";
import { getCachedEntityId } from "../services/entityCache.js";
import { fetchInstitutionMeta } from "../services/institutionMetaService.js";
import { getCategoryMap, verifyTransactionEntity, upsertCategory } from "../db/bankingCategories.js";
import { getAllAccounts } from "../db/accounts.js";
import {
  getRecentTransactions,
  getQboRawObjectsByIds,
} from "../db/transactions.js";
import {
  allocateUniqueQboMatches,
  extractQboHistoricalLines,
} from "../db/qboHistoricalImport.js";
import {
  getHistoricalQboCategoryMap,
  importHistoricalQboMatches,
  type HistoricalQboMatchInput,
} from "../db/bankingQboHistory.js";

// ─── Permission helpers ───────────────────────────────────────────────────────

function canViewBanking(user: AuthUser): boolean {
  return hasPermission(user, "banking");
}

function canManageBanking(user: AuthUser): boolean {
  // admin and cfo can manage (connect, sync, disconnect)
  return user.role === "admin" || user.role === "cfo";
}

// ─── DB pool (DATABASE_URL / heliumdb only) ──────────────────────────────────

const dbUrl = process.env["DATABASE_URL"];
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

async function query<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  if (!pool) throw new Error("DATABASE_URL not configured — Plaid DB unavailable");
  return pool.query<T>(sql, params);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString();
}

/** Safe subset of plaid_accounts columns returned to clients — no access_token. */
interface SafeAccount {
  plaidAccountId: string;
  name: string | null;
  officialName: string | null;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string;
  status: string;
}

function rowToSafeAccount(row: Record<string, unknown>): SafeAccount {
  return {
    plaidAccountId:   String(row["plaid_account_id"] ?? ""),
    name:             row["name"] != null ? String(row["name"]) : null,
    officialName:     row["official_name"] != null ? String(row["official_name"]) : null,
    type:             row["type"] != null ? String(row["type"]) : null,
    subtype:          row["subtype"] != null ? String(row["subtype"]) : null,
    mask:             row["mask"] != null ? String(row["mask"]) : null,
    currentBalance:   row["current_balance"] != null ? Number(row["current_balance"]) : null,
    availableBalance: row["available_balance"] != null ? Number(row["available_balance"]) : null,
    isoCurrencyCode:  String(row["iso_currency_code"] ?? "USD"),
    status:           String(row["status"] ?? "active"),
  };
}

// ─── Internal sync function ───────────────────────────────────────────────────

async function updatePlaidItemWebhook(
  plaidItemId: string,
): Promise<string> {
  const configuredWebhook = (process.env["PLAID_WEBHOOK_URL"] ?? "").trim();

  if (!configuredWebhook) {
    throw new Error("PLAID_WEBHOOK_URL is not configured");
  }

  let parsedWebhook: URL;
  try {
    parsedWebhook = new URL(configuredWebhook);
  } catch {
    throw new Error("PLAID_WEBHOOK_URL is invalid");
  }

  if (parsedWebhook.protocol !== "https:") {
    throw new Error("PLAID_WEBHOOK_URL must use HTTPS");
  }

  const itemResult = await query<{
    access_token_encrypted: string;
    access_token_iv: string;
    access_token_tag: string;
  }>(
    `SELECT access_token_encrypted, access_token_iv, access_token_tag
     FROM plaid_items
     WHERE plaid_item_id = $1
       AND status = 'active'
     LIMIT 1`,
    [plaidItemId],
  );

  const item = itemResult.rows[0];
  if (!item) {
    throw new Error("Active Plaid item not found");
  }

  const accessToken = decryptAccessToken(
    item.access_token_encrypted,
    item.access_token_iv,
    item.access_token_tag,
  );

  await plaidClient.itemWebhookUpdate({
    access_token: accessToken,
    webhook: configuredWebhook,
  });

  return parsedWebhook.pathname;
}

async function syncTransactionsForItem(plaidItemId: string): Promise<{
  added: number;
  modified: number;
  removed: number;
}> {
  const itemRes = await query<Record<string, unknown>>(
    `SELECT plaid_item_id, access_token_encrypted, access_token_iv, access_token_tag,
            transactions_cursor, entity_slug
     FROM plaid_items WHERE plaid_item_id = $1 AND status = 'active'`,
    [plaidItemId],
  );

  if (itemRes.rows.length === 0) {
    throw new Error(`plaid_item not found or not active: ${plaidItemId}`);
  }

  const item = itemRes.rows[0]!;
  // Decrypt access token — NEVER log the result
  const accessToken = decryptAccessToken(
    String(item["access_token_encrypted"]),
    String(item["access_token_iv"]),
    String(item["access_token_tag"]),
  );

  let cursor = item["transactions_cursor"] ? String(item["transactions_cursor"]) : undefined;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  while (hasMore) {
    const syncRes = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    const { added, modified, removed, next_cursor, has_more } = syncRes.data;

    for (const txn of added) {
      await query(
        `INSERT INTO bank_transactions (
           plaid_transaction_id, plaid_account_id, plaid_item_id, entity_slug,
           date, authorized_date, name, merchant_name, amount, iso_currency_code,
           pending, category, personal_finance_category, payment_channel, raw, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'plaid')
         ON CONFLICT (plaid_transaction_id) DO UPDATE SET
           name = EXCLUDED.name,
           merchant_name = EXCLUDED.merchant_name,
           amount = EXCLUDED.amount,
           pending = EXCLUDED.pending,
           category = EXCLUDED.category,
           personal_finance_category = EXCLUDED.personal_finance_category,
           payment_channel = EXCLUDED.payment_channel,
           raw = EXCLUDED.raw,
           updated_at = NOW()`,
        [
          txn.transaction_id,
          txn.account_id,
          plaidItemId,
          String(item["entity_slug"]),
          txn.date,
          txn.authorized_date ?? null,
          txn.name ?? null,
          txn.merchant_name ?? null,
          String(txn.amount),
          txn.iso_currency_code ?? "USD",
          txn.pending,
          txn.category ? JSON.stringify(txn.category) : null,
          txn.personal_finance_category ? JSON.stringify(txn.personal_finance_category) : null,
          txn.payment_channel ?? null,
          JSON.stringify(txn),
        ],
      );
      addedCount++;
    }

    for (const txn of modified) {
      await query(
        `INSERT INTO bank_transactions (
           plaid_transaction_id, plaid_account_id, plaid_item_id, entity_slug,
           date, authorized_date, name, merchant_name, amount, iso_currency_code,
           pending, category, personal_finance_category, payment_channel, raw, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'plaid')
         ON CONFLICT (plaid_transaction_id) DO UPDATE SET
           name = EXCLUDED.name,
           merchant_name = EXCLUDED.merchant_name,
           amount = EXCLUDED.amount,
           pending = EXCLUDED.pending,
           category = EXCLUDED.category,
           personal_finance_category = EXCLUDED.personal_finance_category,
           payment_channel = EXCLUDED.payment_channel,
           raw = EXCLUDED.raw,
           updated_at = NOW()`,
        [
          txn.transaction_id,
          txn.account_id,
          plaidItemId,
          String(item["entity_slug"]),
          txn.date,
          txn.authorized_date ?? null,
          txn.name ?? null,
          txn.merchant_name ?? null,
          String(txn.amount),
          txn.iso_currency_code ?? "USD",
          txn.pending,
          txn.category ? JSON.stringify(txn.category) : null,
          txn.personal_finance_category ? JSON.stringify(txn.personal_finance_category) : null,
          txn.payment_channel ?? null,
          JSON.stringify(txn),
        ],
      );
      modifiedCount++;
    }

    for (const rem of removed) {
      await query(
        `UPDATE bank_transactions SET pending = FALSE, updated_at = NOW()
         WHERE plaid_transaction_id = $1`,
        [rem.transaction_id],
      );
      removedCount++;
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  await query(
    `UPDATE plaid_items
     SET transactions_cursor = $1, last_successful_sync_at = NOW(), updated_at = NOW()
     WHERE plaid_item_id = $2`,
    [cursor ?? null, plaidItemId],
  );

  return { added: addedCount, modified: modifiedCount, removed: removedCount };
}

// ─── Webhook JOSE verification ────────────────────────────────────────────────

// JWK cache: kid → { key, cachedAt }
const jwkCache = new Map<string, { key: CryptoKey; cachedAt: number }>();
const JWK_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const cached = jwkCache.get(kid);
  if (cached && Date.now() - cached.cachedAt < JWK_TTL_MS) return cached.key;

  const response = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const jwk = response.data.key;
  const key = await importJWK(jwk as Parameters<typeof importJWK>[0], "ES256");
  jwkCache.set(kid, { key: key as CryptoKey, cachedAt: Date.now() });
  return key as CryptoKey;
}

async function verifyPlaidWebhook(req: import("express").Request): Promise<Record<string, unknown>> {
  const rawBody = req.body as unknown;
  if (!Buffer.isBuffer(rawBody)) {
    throw Object.assign(new Error("Raw body not available — express.raw() required"), { status: 500 });
  }

  const token = req.headers["plaid-verification"];
  if (!token || typeof token !== "string") {
    throw Object.assign(new Error("Missing Plaid-Verification header"), { status: 400 });
  }

  const header = decodeProtectedHeader(token);
  if (header.alg !== "ES256") {
    throw Object.assign(new Error("Invalid algorithm — expected ES256"), { status: 401 });
  }
  if (!header.kid) {
    throw Object.assign(new Error("Missing kid in JWT header"), { status: 401 });
  }

  const key = await getVerificationKey(header.kid);

  const { payload } = await jwtVerify(token, key, { algorithms: ["ES256"] });

  // Check iat — max 5 minutes old
  const iat = payload.iat;
  if (!iat || Date.now() / 1000 - iat > 300) {
    throw Object.assign(new Error("Webhook JWT is stale"), { status: 401 });
  }

  // Verify body hash
  const expectedHash = payload["request_body_sha256"] as string | undefined;
  if (!expectedHash) {
    throw Object.assign(new Error("Missing request_body_sha256 in JWT"), { status: 401 });
  }
  const actualHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expectedHash, "hex");
  const actualBuf = Buffer.from(actualHash, "hex");
  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw Object.assign(new Error("Body hash mismatch"), { status: 401 });
  }

  return JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
}

function computeEventFingerprint(
  rawBody: Buffer,
  webhookType: string,
  webhookCode: string,
  plaidItemId: string | null,
): string {
  return crypto
    .createHash("sha256")
    .update(rawBody)
    .update(webhookType)
    .update(webhookCode)
    .update(plaidItemId ?? "")
    .digest("hex");
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC WEBHOOK ROUTER — mounted with express.raw() in index.ts BEFORE requireAuth
// ═══════════════════════════════════════════════════════════════════════════

export const plaidWebhookRouter = Router();

plaidWebhookRouter.post(
  "/api/plaid/webhook",
  async (req, res) => {
    // Verify JOSE ES256 signature — fail closed
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = await verifyPlaidWebhook(req);
    } catch (verifyErr) {
      const status = (verifyErr as { status?: number }).status ?? 401;
      const message = verifyErr instanceof Error ? verifyErr.message : "Webhook verification failed";
      // 400 for missing header, 401 for bad signature/stale/hash mismatch
      res.status(status).json({ ok: false, error: message, ts: ts() });
      return;
    }

    const webhookType: string = String(parsedBody["webhook_type"] ?? "UNKNOWN");
    const webhookCode: string = String(parsedBody["webhook_code"] ?? "UNKNOWN");
    const plaidItemId: string | null = (parsedBody["item_id"] as string | undefined) ?? null;

    // Compute deterministic fingerprint for idempotency
    const rawBody = req.body as Buffer;
    const fingerprint = computeEventFingerprint(rawBody, webhookType, webhookCode, plaidItemId);

    // Check for duplicate fingerprint
    let existingRes: { rows: { id: string }[] };
    try {
      existingRes = await query<{ id: string }>(
        `SELECT id FROM plaid_webhook_events WHERE event_fingerprint = $1 LIMIT 1`,
        [fingerprint],
      );
    } catch {
      existingRes = { rows: [] };
    }

    if (existingRes.rows.length > 0) {
      // Already processed — idempotent 200
      res.status(200).json({ ok: true, stored: false, duplicate: true, ts: ts() });
      return;
    }

    // Store every verified webhook before processing — ensures audit trail
    let eventId: string | null = null;
    try {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO plaid_webhook_events
           (webhook_type, webhook_code, plaid_item_id, payload,
            plaid_verification_present, status, event_fingerprint)
         VALUES ($1, $2, $3, $4, TRUE, 'received', $5)
         RETURNING id`,
        [
          webhookType,
          webhookCode,
          plaidItemId,
          JSON.stringify(parsedBody),
          fingerprint,
        ],
      );
      eventId = insertRes.rows[0]?.id ?? null;
    } catch (dbErr) {
      req.log?.error?.({ err: dbErr }, "[plaid-webhook] Failed to store webhook event");
      res.status(200).json({ ok: true, stored: false, ts: ts() });
      return;
    }

    // Trigger async sync for TRANSACTIONS/SYNC_UPDATES_AVAILABLE
    if (webhookType === "TRANSACTIONS" && webhookCode === "SYNC_UPDATES_AVAILABLE" && plaidItemId) {
      setImmediate(async () => {
        try {
          await syncTransactionsForItem(plaidItemId);
          await query(
            `UPDATE plaid_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`,
            [eventId],
          );
        } catch (syncErr) {
          const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
          await query(
            `UPDATE plaid_webhook_events SET status = 'failed', error_message = $1 WHERE id = $2`,
            [msg, eventId],
          ).catch(() => { /* best-effort */ });
        }
      });
    } else {
      setImmediate(async () => {
        await query(
          `UPDATE plaid_webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`,
          [eventId],
        ).catch(() => { /* best-effort */ });
      });
    }

    res.status(200).json({ ok: true, stored: true, ts: ts() });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTER — mount AFTER requireAuth in index.ts
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();

// ─── GET /api/plaid/consent-info ─────────────────────────────────────────────

router.get(
  "/plaid/consent-info",
  requireAuth,
  (req, res) => {
    if (!canViewBanking(req.session.user!)) {
      res.status(403).json({ ok: false, error: "Insufficient permissions", ts: ts() });
      return;
    }
    res.json({
      ok: true,
      data: {
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        consentText: PLAID_CONSENT_TEXT,
        consentTextHash: consentTextHash(),
      },
      ts: ts(),
    });
  },
);

// ─── POST /api/plaid/consent ──────────────────────────────────────────────────

router.post(
  "/plaid/consent",
  requireAuth,
  requirePermission("banking"),
  async (req, res) => {
    const user = req.session.user!;
    const body = req.body as Record<string, unknown>;

    // Validate entitySlug server-side
    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(body["entitySlug"] ?? body["entityId"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entitySlug";
      res.status(400).json({ ok: false, error: msg, ts: ts() });
      return;
    }

    // Resolve validated slug → UUID via Core entity cache (read-only Neon, consistent with Accounting/Budget)
    let entityUuid: string;
    try {
      const resolved = await getCachedEntityId(entitySlug);
      if (!resolved) {
        req.log.error({ entitySlug }, "[plaid] entity slug valid but not found in Core entity registry");
        res.status(503).json({
          ok: false,
          error: `Entity '${entitySlug}' is not found in the entity registry. Contact an administrator.`,
          ts: ts(),
        });
        return;
      }
      entityUuid = resolved;
    } catch (err) {
      req.log.error({ err }, "[plaid] entity UUID resolution failed");
      res.status(503).json({ ok: false, error: "Failed to resolve entity", ts: ts() });
      return;
    }

    // Check for existing active (non-withdrawn) consent for same user+entity+version
    try {
      const existingRes = await query<{ id: string }>(
        `SELECT id FROM plaid_consent_records
         WHERE user_email = $1 AND entity_id = $2 AND policy_version = $3
           AND (withdrawn_at IS NULL)
         LIMIT 1`,
        [user.email, entityUuid, CURRENT_PRIVACY_POLICY_VERSION],
      );

      if (existingRes.rows.length > 0) {
        res.json({
          ok: true,
          data: {
            consentId: existingRes.rows[0]!.id,
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            existing: true,
          },
          ts: ts(),
        });
        return;
      }
    } catch (err) {
      req.log.error({ err }, "[plaid] consent duplicate check failed");
      res.status(500).json({ ok: false, error: "Failed to check existing consent", ts: ts() });
      return;
    }

    // Build and insert consent record — entity_id is now a real UUID from heliumdb
    const record = buildConsentRecord({
      userEmail: user.email,
      entityId: entityUuid,
      ipAddress: req.ip ?? undefined,
      userAgent: req.headers["user-agent"] ?? undefined,
    });

    try {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO plaid_consent_records
           (user_email, entity_id, policy_version, consent_text_hash,
            scope_requested, plaid_products, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          record.user_email,
          record.entity_id,
          record.policy_version,
          record.consent_text_hash,
          record.scope_requested,
          record.plaid_products,
          record.ip_address,
          record.user_agent,
        ],
      );

      const consentId = insertRes.rows[0]!.id;
      res.json({
        ok: true,
        data: { consentId, policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
        ts: ts(),
      });
    } catch (err) {
      req.log.error({ err }, "[plaid] consent insert failed");
      res.status(500).json({ ok: false, error: "Failed to record consent", ts: ts() });
    }
  },
);

// ─── POST /api/plaid/link-token ───────────────────────────────────────────────

router.post(
  "/plaid/link-token",
  requireAuth,
  async (req, res) => {
    const user = req.session.user!;

    // Management permission required to create link tokens
    if (!canManageBanking(user)) {
      res.status(403).json({
        ok: false,
        error: "Only admin or CFO can connect bank accounts",
        ts: ts(),
      });
      return;
    }

    const body = req.body as Record<string, unknown>;

    // Validate entitySlug server-side
    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(body["entitySlug"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entitySlug";
      res.status(400).json({ ok: false, error: msg, ts: ts() });
      return;
    }

    // Resolve slug → UUID via Core entity cache (read-only Neon, consistent with Accounting/Budget)
    let entityUuid: string;
    try {
      const resolved = await getCachedEntityId(entitySlug);
      if (!resolved) {
        req.log.error({ entitySlug }, "[plaid] entity slug valid but not found in Core entity registry during link-token");
        res.status(503).json({
          ok: false,
          error: `Entity '${entitySlug}' is not found in the entity registry. Contact an administrator.`,
          ts: ts(),
        });
        return;
      }
      entityUuid = resolved;
    } catch (err) {
      req.log.error({ err }, "[plaid] entity UUID resolution failed during link-token");
      res.status(503).json({ ok: false, error: "Failed to resolve entity", ts: ts() });
      return;
    }

    // Require existing, non-withdrawn consent record before issuing link token
    try {
      const consentRes = await query<{ id: string }>(
        `SELECT id FROM plaid_consent_records
         WHERE user_email = $1 AND entity_id = $2 AND policy_version = $3
           AND (withdrawn_at IS NULL)
         LIMIT 1`,
        [user.email, entityUuid, CURRENT_PRIVACY_POLICY_VERSION],
      );

      if (consentRes.rows.length === 0) {
        res.status(403).json({
          ok: false,
          error: "Consent required before connecting a bank account. Please accept the data sharing agreement.",
          code: "CONSENT_REQUIRED",
          ts: ts(),
        });
        return;
      }
    } catch (err) {
      req.log.error({ err }, "[plaid] consent check failed");
      res.status(500).json({ ok: false, error: "Failed to verify consent", ts: ts() });
      return;
    }

    try {
      const webhookUrl   = process.env["PLAID_WEBHOOK_URL"] ?? "";
      // APP_PUBLIC_URL is required for OAuth institutions (Chase, Wells Fargo, etc.).
      // redirect_uri must match exactly what is registered in the Plaid Dashboard.
      const appPublicUrl = (process.env["APP_PUBLIC_URL"] ?? "").replace(/\/$/, "");
      const redirectUri  = appPublicUrl ? `${appPublicUrl}/accounting/banking` : undefined;
      if (!redirectUri) {
        req.log.warn(
          "[plaid] APP_PUBLIC_URL not configured — OAuth institutions (Chase, etc.) will " +
          "close immediately. Set APP_PUBLIC_URL=https://finance-os-1.replit.app in Replit Secrets " +
          "and add the redirect URI to the Plaid Dashboard.",
        );
      }
      const linkRes = await plaidClient.linkTokenCreate({
        user: { client_user_id: user.id },
        client_name: "FinanceOS",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
        webhook: webhookUrl || undefined,
        redirect_uri: redirectUri,
        transactions: { days_requested: 730 },
      });

      res.json({
        ok: true,
        data: { linkToken: linkRes.data.link_token },
        ts: ts(),
      });
    } catch (err) {
      req.log.error({ err }, "[plaid] link-token creation failed");
      res.status(502).json({ ok: false, error: "Failed to create Plaid link token", ts: ts() });
    }
  },
);

// ─── POST /api/plaid/exchange-token ──────────────────────────────────────────

router.post(
  "/plaid/exchange-token",
  requireAuth,
  async (req, res) => {
    const user = req.session.user!;
    if (!canManageBanking(user)) {
      res.status(403).json({ ok: false, error: "Only admin or CFO can connect bank accounts", ts: ts() });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const publicToken = body["publicToken"];

    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(body["entitySlug"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entitySlug";
      res.status(400).json({ ok: false, error: msg, ts: ts() });
      return;
    }

    if (!publicToken || typeof publicToken !== "string") {
      res.status(400).json({ ok: false, error: "publicToken required", ts: ts() });
      return;
    }

    try {
      const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
      const { access_token, item_id } = exchangeRes.data;

      // Encrypt immediately — plaintext access_token is never stored or returned
      const { encrypted, iv, tag } = encryptAccessToken(access_token);

      const institution = (body["metadata"] as Record<string, unknown> | undefined)?.["institution"] as Record<string, unknown> | undefined;
      const institutionId: string = String(institution?.["institution_id"] ?? "");
      const institutionName: string = String(institution?.["name"] ?? "");

      await query(
        `INSERT INTO plaid_items
           (entity_slug, plaid_item_id, institution_id, institution_name,
            access_token_encrypted, access_token_iv, access_token_tag,
            status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)
         ON CONFLICT (plaid_item_id) DO UPDATE SET
           institution_name = EXCLUDED.institution_name,
           access_token_encrypted = EXCLUDED.access_token_encrypted,
           access_token_iv = EXCLUDED.access_token_iv,
           access_token_tag = EXCLUDED.access_token_tag,
           status = 'active',
           updated_at = NOW()`,
        [entitySlug, item_id, institutionId, institutionName, encrypted, iv, tag, user.email],
      );

      const accountsRes = await plaidClient.accountsGet({ access_token });
      const accounts = accountsRes.data.accounts;

      for (const acct of accounts) {
        await query(
          `INSERT INTO plaid_accounts
             (plaid_item_id, plaid_account_id, entity_slug, name, official_name,
              type, subtype, mask, current_balance, available_balance, iso_currency_code, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
           ON CONFLICT (plaid_account_id) DO UPDATE SET
             name = EXCLUDED.name,
             official_name = EXCLUDED.official_name,
             current_balance = EXCLUDED.current_balance,
             available_balance = EXCLUDED.available_balance,
             status = 'active',
             updated_at = NOW()`,
          [
            item_id, acct.account_id, entitySlug,
            acct.name ?? null, acct.official_name ?? null,
            acct.type ?? null, acct.subtype ?? null, acct.mask ?? null,
            acct.balances.current != null ? String(acct.balances.current) : null,
            acct.balances.available != null ? String(acct.balances.available) : null,
            acct.balances.iso_currency_code ?? "USD",
          ],
        );
      }

      setImmediate(() => {
        syncTransactionsForItem(item_id).catch((err) => {
          req.log.error({ err, plaidItemId: item_id }, "[plaid] Initial sync failed");
        });
      });

      res.json({
        ok: true,
        data: {
          itemId: item_id,
          institutionName,
          accounts: accounts.map((acct) => ({
            plaidAccountId: acct.account_id,
            name: acct.name,
            officialName: acct.official_name ?? null,
            type: acct.type,
            subtype: acct.subtype ?? null,
            mask: acct.mask ?? null,
            currentBalance: acct.balances.current ?? null,
            availableBalance: acct.balances.available ?? null,
            isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
          })),
        },
        ts: ts(),
      });
    } catch (err) {
      req.log.error({ err }, "[plaid] exchange-token failed");
      res.status(502).json({ ok: false, error: "Failed to exchange Plaid token", ts: ts() });
    }
  },
);

// ─── POST /api/plaid/items/:id/sync ──────────────────────────────────────────

router.post(
  "/plaid/items/:id/sync",
  requireAuth,
  async (req, res) => {
    const user = req.session.user!;
    // admin and cfo can trigger manual syncs
    if (!canManageBanking(user)) {
      res.status(403).json({ ok: false, error: "Insufficient permissions to trigger sync", ts: ts() });
      return;
    }

    const rawId = req.params["id"];
    const plaidItemId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!plaidItemId) {
      res.status(400).json({ ok: false, error: "item id required", ts: ts() });
      return;
    }

    // Verify the item belongs to an entity the requester is allowed to manage.
    // Without this check any canManageBanking user could sync any entity's item.
    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(req.query["entitySlug"] ?? req.body?.["entitySlug"]);
    } catch {
      res.status(400).json({ ok: false, error: "entitySlug required and must be a valid entity", ts: ts() });
      return;
    }

    try {
      const ownershipRes = await query<{ plaid_item_id: string }>(
        `SELECT plaid_item_id FROM plaid_items WHERE plaid_item_id = $1 AND entity_slug = $2 AND status = 'active' LIMIT 1`,
        [plaidItemId, entitySlug],
      );
      if (ownershipRes.rows.length === 0) {
        res.status(404).json({ ok: false, error: "Item not found for the specified entity", ts: ts() });
        return;
      }
    } catch (err) {
      req.log.error({ err }, "[plaid] ownership check failed for sync");
      res.status(500).json({ ok: false, error: "Failed to verify item ownership", ts: ts() });
      return;
    }

    try {
      const webhookPath = await updatePlaidItemWebhook(plaidItemId);
      const summary = await syncTransactionsForItem(plaidItemId);
      res.json({
        ok: true,
        data: {
          plaidItemId,
          webhookUpdated: true,
          webhookPath,
          ...summary,
        },
        ts: ts(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.log.error({ err, plaidItemId }, "[plaid] manual sync failed");
      res.status(502).json({ ok: false, error: msg, ts: ts() });
    }
  },
);

// ─── GET /api/plaid/accounts ──────────────────────────────────────────────────

router.get(
  "/plaid/accounts",
  requireAuth,
  async (req, res) => {
    if (!canViewBanking(req.session.user!)) {
      res.status(403).json({ ok: false, error: "Insufficient permissions", ts: ts() });
      return;
    }

    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(req.query["entitySlug"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entitySlug";
      res.status(400).json({ ok: false, error: msg, ts: ts() });
      return;
    }

    try {
      const result = await query<Record<string, unknown>>(
        `SELECT pa.plaid_account_id, pa.name, pa.official_name, pa.type, pa.subtype,
                pa.mask, pa.current_balance, pa.available_balance, pa.iso_currency_code,
                pa.status, pi.institution_name, pi.institution_id, pi.plaid_item_id, pi.last_successful_sync_at
         FROM plaid_accounts pa
         JOIN plaid_items pi ON pi.plaid_item_id = pa.plaid_item_id
         WHERE pa.entity_slug = $1 AND pa.status = 'active' AND pi.status = 'active'
         ORDER BY pa.created_at ASC`,
        [entitySlug],
      );

      // Deduplicate institution_ids — one fetchInstitutionMeta call per institution,
      // not one per account. fetchInstitutionMeta is TTL-cached; Plaid failures
      // return null gracefully without breaking this response.
      const uniqueInstIds = [
        ...new Set(
          result.rows
            .map((r) => r["institution_id"])
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];
      const metaEntries = await Promise.all(
        uniqueInstIds.map(async (id) => [id, await fetchInstitutionMeta(id)] as const),
      );
      const metaMap = new Map(metaEntries);

      res.json({
        ok: true,
        data: result.rows.map((row) => {
          const instId =
            typeof row["institution_id"] === "string" ? row["institution_id"] : null;
          const meta = instId ? metaMap.get(instId) : undefined;
          return {
            ...rowToSafeAccount(row),
            institutionName: row["institution_name"] ?? null,
            institutionLogo: meta?.logoDataUri ?? null,
            institutionPrimaryColor: meta?.primaryColor ?? null,
            plaidItemId: row["plaid_item_id"],
            lastSyncAt: row["last_successful_sync_at"] ?? null,
          };
        }),
        ts: ts(),
      });
    } catch (err) {
      req.log.error({ err }, "[plaid] get-accounts failed");
      res.status(500).json({ ok: false, error: "Failed to fetch accounts", ts: ts() });
    }
  },
);

// ─── GET /api/plaid/transactions ─────────────────────────────────────────────

router.get(
  "/plaid/transactions",
  requireAuth,
  async (req, res) => {
    if (!canViewBanking(req.session.user!)) {
      res.status(403).json({ ok: false, error: "Insufficient permissions", ts: ts() });
      return;
    }

    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(req.query["entitySlug"]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid entitySlug";
      res.status(400).json({ ok: false, error: msg, ts: ts() });
      return;
    }

    const accountId = req.query["accountId"] as string | undefined;
    const from      = req.query["from"]      as string | undefined;
    const to        = req.query["to"]        as string | undefined;
    const pageStr   = req.query["page"]      as string | undefined;
    const limitStr  = req.query["limit"]     as string | undefined;

    const page  = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(limitStr ?? "100", 10) || 100));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["bt.entity_slug = $1"];
    const params: unknown[] = [entitySlug];
    let paramIdx = 2;

    if (accountId) { conditions.push(`bt.plaid_account_id = $${paramIdx++}`); params.push(accountId); }
    if (from)      { conditions.push(`bt.date >= $${paramIdx++}`);            params.push(from); }
    if (to)        { conditions.push(`bt.date <= $${paramIdx++}`);            params.push(to); }

    const where = conditions.join(" AND ");

    try {
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM bank_transactions bt WHERE ${where}`,
        params,
      );
      const total = parseInt(countRes.rows[0]?.count ?? "0", 10);

      const dataRes = await query<Record<string, unknown>>(
        `SELECT bt.plaid_transaction_id, bt.plaid_account_id, bt.name, bt.merchant_name,
                bt.amount, bt.iso_currency_code, bt.date, bt.authorized_date,
                bt.pending, bt.category, bt.personal_finance_category, bt.payment_channel
         FROM bank_transactions bt
         WHERE ${where}
         ORDER BY bt.date DESC, bt.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset],
      );

      res.json({
        ok: true,
        data: {
          transactions: dataRes.rows.map((row) => ({
            id:                      row["plaid_transaction_id"],
            accountId:               row["plaid_account_id"],
            name:                    row["name"],
            merchantName:            row["merchant_name"],
            amount:                  row["amount"] != null ? Number(row["amount"]) : null,
            isoCurrencyCode:         row["iso_currency_code"],
            date:                    row["date"],
            authorizedDate:          row["authorized_date"],
            pending:                 row["pending"],
            category:                row["category"],
            personalFinanceCategory: row["personal_finance_category"],
            paymentChannel:          row["payment_channel"],
          })),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
        ts: ts(),
      });
    } catch (err) {
      req.log.error({ err }, "[plaid] get-transactions failed");
      res.status(500).json({ ok: false, error: "Failed to fetch transactions", ts: ts() });
    }
  },
);


// ─── GET /api/plaid/qbo-match-preview ───────────────────────────────────────
// Read-only deterministic preview. Never writes categories or reconciliation.
router.all(
  [
    "/plaid/qbo-match-preview",
    "/plaid/qbo-history-import",
  ],
  requireAuth,
  async (req, res) => {
    const requestPath =
      req.originalUrl.split("?")[0] ?? "";
    const isPreviewPath =
      requestPath.endsWith("/plaid/qbo-match-preview");
    const isImportPath =
      requestPath.endsWith("/plaid/qbo-history-import");
    const executeImport =
      isImportPath && req.method === "POST";

    if (
      (isPreviewPath && req.method !== "GET") ||
      (isImportPath && req.method !== "POST")
    ) {
      res.status(405).json({
        ok: false,
        error: "Method not allowed",
        ts: ts(),
      });
      return;
    }

    if (executeImport && !canManageBanking(req.session.user!)) {
      res.status(403).json({
        ok: false,
        error: "Only admin or CFO can import QBO history",
        ts: ts(),
      });
      return;
    }

    if (executeImport) {
      const body = req.body as Record<string, unknown>;

      if (body["confirm"] !== "IMPORT_QBO_HISTORY") {
        res.status(400).json({
          ok: false,
          error: "Explicit import confirmation required",
          ts: ts(),
        });
        return;
      }
    }
    if (!canViewBanking(req.session.user!)) {
      res.status(403).json({
        ok: false,
        error: "Banking access required",
        ts: ts(),
      });
      return;
    }

    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(req.query["entitySlug"]);
    } catch {
      res.status(400).json({
        ok: false,
        error: "entitySlug required and must be valid",
        ts: ts(),
      });
      return;
    }

    const from =
      typeof req.query["from"] === "string"
        ? req.query["from"]
        : "2025-01-01";

    try {
      const entityId = await getCachedEntityId(entitySlug);
      if (!entityId) {
        res.status(404).json({
          ok: false,
          error: "Entity not found",
          ts: ts(),
        });
        return;
      }

      const plaidResult = await query<Record<string, unknown>>(
        `SELECT
           bt.plaid_transaction_id,
           bt.plaid_account_id,
           bt.date,
           bt.amount,
           bt.name,
           bt.merchant_name,
           pa.name AS plaid_account_name,
           pa.mask AS plaid_account_mask,
           pa.type AS plaid_account_type
         FROM bank_transactions bt
         JOIN plaid_accounts pa
           ON pa.plaid_account_id = bt.plaid_account_id
          AND pa.entity_slug = bt.entity_slug
         JOIN plaid_items pi
           ON pi.plaid_item_id = pa.plaid_item_id
          AND pi.entity_slug = pa.entity_slug
         WHERE bt.entity_slug = $1
           AND bt.date >= $2
           AND pi.institution_name = 'Mercury'
           AND pa.status = 'active'
         ORDER BY bt.date, bt.plaid_transaction_id`,
        [entitySlug, from],
      );

      const [qboAccounts, qboTransactions] = await Promise.all([
        getAllAccounts(entityId),
        getRecentTransactions(entityId, 10_000, from, null),
      ]);

      const eligibleQboAccounts = qboAccounts.filter((account) =>
        ["Bank", "Credit Card"].includes(account.accountType ?? ""),
      );

      function mappedQboAccount(
        plaidName: string,
        plaidMask: string,
        plaidType: string,
      ) {
        const lowerName = plaidName.toLowerCase();

        let candidates = eligibleQboAccounts.filter((account) => {
          const qboName = (account.name ?? "").toLowerCase();

          if (plaidMask && plaidMask !== "0000") {
            return qboName.includes(plaidMask);
          }

          if (
            plaidType === "credit" ||
            lowerName.includes("credit")
          ) {
            return (
              qboName.includes("mercury") &&
              qboName.includes("credit")
            );
          }

          return false;
        });

        if (candidates.length !== 1) return null;
        return candidates[0];
      }

      const accountMappings = new Map<
        string,
        { id: string; name: string | null } | null
      >();

      for (const row of plaidResult.rows) {
        const plaidAccountId = String(row["plaid_account_id"] ?? "");
        if (accountMappings.has(plaidAccountId)) continue;

        const match = mappedQboAccount(
          String(row["plaid_account_name"] ?? ""),
          String(row["plaid_account_mask"] ?? ""),
          String(row["plaid_account_type"] ?? ""),
        );

        accountMappings.set(
          plaidAccountId,
          match ? { id: match.id, name: match.name } : null,
        );
      }

      function dateOnly(value: unknown): string {
        if (value instanceof Date) {
          return value.toISOString().slice(0, 10);
        }

        const raw = String(value ?? "").trim();
        if (!raw) return "";

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime())
          ? raw.slice(0, 10)
          : parsed.toISOString().slice(0, 10);
      }

      let exact = 0;
      let ambiguous = 0;
      let unmatched = 0;
      let unmappedAccount = 0;
      let uniqueWithin3Days = 0;
      let ambiguousWithin3Days = 0;
      let unmatchedWithin3Days = 0;
      let amountMatchAnyDate = 0;
      let dateAndAmountMatchAnyAccount = 0;
      let sourceAccountAndAmountMatchAnyDate = 0;
      const uniqueQboMatchIds: string[] = [];
      const uniqueQboMatches: Array<{
        plaidTransactionId: string;
        qboId: string;
        dateDeltaDays: number;
      }> = [];

      const byAccount = new Map<
        string,
        {
          plaidAccountName: string;
          mask: string;
          qboAccountName: string | null;
          total: number;
          exact: number;
          ambiguous: number;
          unmatched: number;
          unmappedAccount: number;
        }
      >();

      for (const row of plaidResult.rows) {
        const plaidAccountId = String(row["plaid_account_id"] ?? "");
        const plaidAccountName = String(row["plaid_account_name"] ?? "");
        const mask = String(row["plaid_account_mask"] ?? "");
        const mapping = accountMappings.get(plaidAccountId) ?? null;

        const accountSummary =
          byAccount.get(plaidAccountId) ?? {
            plaidAccountName,
            mask,
            qboAccountName: mapping?.name ?? null,
            total: 0,
            exact: 0,
            ambiguous: 0,
            unmatched: 0,
            unmappedAccount: 0,
          };

        accountSummary.total += 1;

        if (!mapping) {
          unmappedAccount += 1;
          accountSummary.unmappedAccount += 1;
          byAccount.set(plaidAccountId, accountSummary);
          continue;
        }

        const plaidDate = dateOnly(row["date"]);
        const plaidAmount = Math.abs(Number(row["amount"] ?? 0));

        const candidates = qboTransactions.filter((transaction) => {
          const qboAmount =
            transaction.amount == null
              ? Number.NaN
              : Math.abs(Number(transaction.amount));

          const qboSourceAccount = String(
            transaction.accountName ?? "",
          )
            .trim()
            .toLowerCase();

          const plaidAccountType = String(
            row["plaid_account_type"] ?? "",
          ).toLowerCase();

          const sourceAccountMatches =
            mask && mask !== "0000"
              ? qboSourceAccount.includes(mask)
              : (
                  plaidAccountType === "credit" &&
                  qboSourceAccount.includes("mercury") &&
                  qboSourceAccount.includes("credit")
                );

          return (
            sourceAccountMatches &&
            dateOnly(transaction.transactionDate) ===
              plaidDate &&
            Number.isFinite(qboAmount) &&
            Math.abs(qboAmount - plaidAmount) < 0.005
          );
        });

        const plaidDay = Date.parse(`${plaidDate}T00:00:00Z`);
        const plaidAccountType = String(
          row["plaid_account_type"] ?? "",
        ).toLowerCase();

        const amountCandidates = qboTransactions.filter((transaction) => {
          if (transaction.amount == null) return false;
          const qboAmount = Math.abs(Number(transaction.amount));
          return (
            Number.isFinite(qboAmount) &&
            Math.abs(qboAmount - plaidAmount) < 0.005
          );
        });

        if (amountCandidates.length > 0) {
          amountMatchAnyDate += 1;
        }

        if (
          amountCandidates.some(
            (transaction) =>
              dateOnly(transaction.transactionDate) ===
              plaidDate,
          )
        ) {
          dateAndAmountMatchAnyAccount += 1;
        }

        if (
          amountCandidates.some((transaction) => {
            const qboSourceAccount = String(
              transaction.accountName ?? "",
            )
              .trim()
              .toLowerCase();

            return mask && mask !== "0000"
              ? qboSourceAccount.includes(mask)
              : (
                  plaidAccountType === "credit" &&
                  qboSourceAccount.includes("mercury") &&
                  qboSourceAccount.includes("credit")
                );
          })
        ) {
          sourceAccountAndAmountMatchAnyDate += 1;
        }

        const candidatesWithin3Days = qboTransactions.filter((transaction) => {
          const qboAmount =
            transaction.amount == null
              ? Number.NaN
              : Math.abs(Number(transaction.amount));

          const qboSourceAccount = String(
            transaction.accountName ?? "",
          )
            .trim()
            .toLowerCase();

          const plaidAccountType = String(
            row["plaid_account_type"] ?? "",
          ).toLowerCase();

          const sourceAccountMatches =
            mask && mask !== "0000"
              ? qboSourceAccount.includes(mask)
              : (
                  plaidAccountType === "credit" &&
                  qboSourceAccount.includes("mercury") &&
                  qboSourceAccount.includes("credit")
                );

          const qboDate = String(
            transaction.transactionDate ?? "",
          ).slice(0, 10);
          const qboDay = Date.parse(`${qboDate}T00:00:00Z`);
          const dayDifference =
            Number.isFinite(plaidDay) && Number.isFinite(qboDay)
              ? Math.abs(qboDay - plaidDay) / 86_400_000
              : Number.POSITIVE_INFINITY;

          return (
            sourceAccountMatches &&
            dayDifference <= 3 &&
            Number.isFinite(qboAmount) &&
            Math.abs(qboAmount - plaidAmount) < 0.005
          );
        });

        if (candidatesWithin3Days.length === 1) {
          uniqueWithin3Days += 1;
          const uniqueQboId = String(
            candidatesWithin3Days[0]?.qboId ?? "",
          );
          if (uniqueQboId) {
            uniqueQboMatchIds.push(uniqueQboId);

            const uniqueQboDate = dateOnly(
              candidatesWithin3Days[0]?.transactionDate,
            );
            const uniqueQboDay = Date.parse(
              `${uniqueQboDate}T00:00:00Z`,
            );
            const dateDeltaDays =
              Number.isFinite(plaidDay) &&
              Number.isFinite(uniqueQboDay)
                ? Math.round(
                    Math.abs(uniqueQboDay - plaidDay) /
                      86_400_000,
                  )
                : 0;

            uniqueQboMatches.push({
              plaidTransactionId: String(
                row["plaid_transaction_id"] ?? "",
              ),
              qboId: uniqueQboId,
              dateDeltaDays,
            });
          }
        } else if (candidatesWithin3Days.length > 1) {
          ambiguousWithin3Days += 1;
        } else {
          unmatchedWithin3Days += 1;
        }

        if (candidates.length === 1) {
          exact += 1;
          accountSummary.exact += 1;
        } else if (candidates.length > 1) {
          ambiguous += 1;
          accountSummary.ambiguous += 1;
        } else {
          unmatched += 1;
          accountSummary.unmatched += 1;
        }

        byAccount.set(plaidAccountId, accountSummary);
      }

      const qboAllocation = allocateUniqueQboMatches(
        uniqueQboMatches,
      );

      uniqueQboMatches.splice(
        0,
        uniqueQboMatches.length,
        ...qboAllocation.matches,
      );
      uniqueQboMatchIds.splice(
        0,
        uniqueQboMatchIds.length,
        ...qboAllocation.matches.map((match) => match.qboId),
      );

      const qboRawObjects = await getQboRawObjectsByIds(
        entityId,
        uniqueQboMatchIds,
      );

      const rawByQboId = new Map<string, typeof qboRawObjects>();
      for (const raw of qboRawObjects) {
        const existing = rawByQboId.get(raw.qboId) ?? [];
        existing.push(raw);
        rawByQboId.set(raw.qboId, existing);
      }

      let rawObjectFound = 0;
      let rawObjectMissing = 0;
      let rawObjectAmbiguous = 0;
      let categorizedLineCount = 0;
      let classLineCount = 0;
      let splitMatchCount = 0;

      for (const qboId of uniqueQboMatchIds) {
        const rawMatches = rawByQboId.get(qboId) ?? [];

        if (rawMatches.length === 0) {
          rawObjectMissing += 1;
          continue;
        }

        if (rawMatches.length > 1) {
          rawObjectAmbiguous += 1;
          continue;
        }

        rawObjectFound += 1;

        const payload = rawMatches[0]?.payload;
        if (
          !payload ||
          typeof payload !== "object" ||
          Array.isArray(payload)
        ) {
          continue;
        }

        const lines = (
          payload as Record<string, unknown>
        )["Line"];

        if (!Array.isArray(lines)) continue;

        let categorizedLinesForMatch = 0;

        for (const rawLine of lines) {
          if (
            !rawLine ||
            typeof rawLine !== "object" ||
            Array.isArray(rawLine)
          ) {
            continue;
          }

          const line = rawLine as Record<string, unknown>;

          for (const [key, rawDetail] of Object.entries(line)) {
            if (
              !key.endsWith("LineDetail") ||
              !rawDetail ||
              typeof rawDetail !== "object" ||
              Array.isArray(rawDetail)
            ) {
              continue;
            }

            const detail = rawDetail as Record<string, unknown>;
            const accountRef = detail["AccountRef"];
            const classRef = detail["ClassRef"];

            if (
              accountRef &&
              typeof accountRef === "object" &&
              !Array.isArray(accountRef)
            ) {
              categorizedLineCount += 1;
              categorizedLinesForMatch += 1;
            }

            if (
              classRef &&
              typeof classRef === "object" &&
              !Array.isArray(classRef)
            ) {
              classLineCount += 1;
            }
          }
        }

        if (categorizedLinesForMatch > 1) {
          splitMatchCount += 1;
        }
      }

      const manuallyCategorized = await getCategoryMap(
        entitySlug,
        uniqueQboMatches.map(
          (match) => match.plaidTransactionId,
        ),
      );

      const readyImports: HistoricalQboMatchInput[] = [];
      let readyMatchCount = 0;
      let readyLineCount = 0;
      let readySplitMatchCount = 0;
      let readyClassLineCount = 0;
      let manualCategoryExcluded = 0;
      let noCategorizedLinesExcluded = 0;
      let ambiguousRawObjectExcluded = 0;
      let missingRawObjectExcluded = 0;

      for (const match of uniqueQboMatches) {
        if (manuallyCategorized[match.plaidTransactionId]) {
          manualCategoryExcluded += 1;
          continue;
        }

        const rawMatches = rawByQboId.get(match.qboId) ?? [];

        if (rawMatches.length === 0) {
          missingRawObjectExcluded += 1;
          continue;
        }

        if (rawMatches.length > 1) {
          ambiguousRawObjectExcluded += 1;
          continue;
        }

        const lines = extractQboHistoricalLines(
          rawMatches[0]?.payload,
        );

        if (lines.length === 0) {
          noCategorizedLinesExcluded += 1;
          continue;
        }

        readyImports.push({
          plaidTransactionId: match.plaidTransactionId,
          qboId: match.qboId,
          qboObjectType: String(
            rawMatches[0]?.objectType ?? "Unknown",
          ),
          dateDeltaDays: match.dateDeltaDays,
          confidence:
            match.dateDeltaDays === 0
              ? 1
              : 1 - match.dateDeltaDays * 0.02,
          lines,
        });

        readyMatchCount += 1;
        readyLineCount += lines.length;

        if (lines.length > 1) {
          readySplitMatchCount += 1;
        }

        readyClassLineCount += lines.filter(
          (line) => line.qboClassId !== null,
        ).length;
      }

      const importPlan = {
        dryRun: true,
        candidateMatchCount: uniqueQboMatches.length,
        duplicateQboClaimsExcluded:
          qboAllocation.duplicateClaimsExcluded,
        ambiguousQboClaimsExcluded:
          qboAllocation.ambiguousClaimsExcluded,
        readyMatchCount,
        readyLineCount,
        readySplitMatchCount,
        readyClassLineCount,
        manualCategoryExcluded,
        noCategorizedLinesExcluded,
        ambiguousRawObjectExcluded,
        missingRawObjectExcluded,
        writesPerformed: 0,
      };

      let importResult = null;

      if (executeImport) {
        importResult = await importHistoricalQboMatches({
          entitySlug,
          importedBy: req.session.user!.id,
          matches: readyImports,
        });

        importPlan.writesPerformed =
          importResult.importedMatchCount;
      }

      res.json({
        ok: true,
        data: {
          entitySlug,
          from,
          importResult,
          totalPlaidTransactions: plaidResult.rows.length,
          totalQboTransactions: qboTransactions.length,
          exact,
          ambiguous,
          unmatched,
          unmappedAccount,
          uniqueWithin3Days,
          ambiguousWithin3Days,
          unmatchedWithin3Days,
          amountMatchAnyDate,
          dateAndAmountMatchAnyAccount,
          sourceAccountAndAmountMatchAnyDate,
          rawObjectFound,
          rawObjectMissing,
          rawObjectAmbiguous,
          categorizedLineCount,
          classLineCount,
          splitMatchCount,
          importPlan,
          accounts: Array.from(byAccount.values()),
        },
        ts: ts(),
      });
    } catch (err) {
      req.log.error(
        { err, entitySlug },
        "[plaid] QBO match preview failed",
      );
      res.status(500).json({
        ok: false,
        error: "Failed to build QBO match preview",
        ts: ts(),
      });
    }
  },
);


// ─── GET /api/plaid/qbo-history-categories ─────────────────────────────────
// Historical QBO suggestions only. Manual FinanceOS categories remain
// authoritative and must be overlaid first by API consumers.
router.get(
  "/plaid/qbo-history-categories",
  requireAuth,
  async (req, res) => {
    if (!canViewBanking(req.session.user!)) {
      res.status(403).json({
        ok: false,
        error: "Banking access required",
        ts: ts(),
      });
      return;
    }

    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(req.query["entitySlug"]);
    } catch {
      res.status(400).json({
        ok: false,
        error: "entitySlug required and must be valid",
        ts: ts(),
      });
      return;
    }

    const rawIds =
      typeof req.query["txIds"] === "string"
        ? req.query["txIds"]
        : "";

    const transactionIds = Array.from(
      new Set(
        rawIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );

    if (transactionIds.length > 200) {
      res.status(400).json({
        ok: false,
        error: "Maximum 200 transaction IDs",
        ts: ts(),
      });
      return;
    }

    try {
      const data = await getHistoricalQboCategoryMap(
        entitySlug,
        transactionIds,
      );

      res.json({ ok: true, data, ts: ts() });
    } catch (err) {
      req.log.error(
        { err },
        "[plaid] get-qbo-history-categories failed",
      );
      res.status(500).json({
        ok: false,
        error: "Failed to load QBO history categories",
        ts: ts(),
      });
    }
  },
);

// ─── GET /api/plaid/transaction-categories ───────────────────────────────────
// Returns FinanceOS category metadata keyed by plaid_transaction_id.
// Read access: requireAuth + canViewBanking. Maximum 200 txIds.
router.get(
  "/plaid/transaction-categories",
  requireAuth,
  async (req, res) => {
    if (!canViewBanking(req.session.user!))
      return res.status(403).json({ ok: false, error: "Banking access required", ts: ts() });
    let entitySlug: string;
    try { entitySlug = validateEntitySlug(req.query["entitySlug"]); }
    catch { return res.status(400).json({ ok: false, error: "entitySlug required and must be a valid entity", ts: ts() }); }
    const raw  = req.query["txIds"];
    const txIds = typeof raw === "string" ? raw.split(",").filter(Boolean) : [];
    if (txIds.length > 200)
      return res.status(400).json({ ok: false, error: "txIds exceeds maximum of 200", ts: ts() });
    try {
      const data = await getCategoryMap(entitySlug, txIds);
      return res.json({ ok: true, data, ts: ts() });
    } catch (err) {
      req.log.error({ err }, "[plaid] get-transaction-categories failed");
      return res.status(500).json({ ok: false, error: "Failed to fetch categories", ts: ts() });
    }
  },
);

// ─── PATCH /api/plaid/transactions/:txId/category ────────────────────────────
// Sets or updates the FinanceOS category for one transaction.
// Write access: requireAuth + requirePermission("banking").
// Never modifies bank_transactions. Rejects cross-entity writes.
// COA account verified against Core — client-provided name/type are ignored.
router.patch(
  "/plaid/transactions/:txId/category",
  requireAuth,
  requirePermission("banking"),
  async (req, res) => {
    const rawTxId = req.params["txId"];
    const txId = (typeof rawTxId === "string" ? rawTxId : "").trim();
    if (!txId)
      return res.status(400).json({ ok: false, error: "txId is required", ts: ts() });
    const body = req.body as Record<string, unknown>;
    let entitySlug: string;
    try { entitySlug = validateEntitySlug(body["entitySlug"]); }
    catch { return res.status(400).json({ ok: false, error: "entitySlug required and must be a valid entity", ts: ts() }); }
    const coaAccountId = typeof body["coaAccountId"] === "string" ? body["coaAccountId"].trim() : "";
    if (!coaAccountId)
      return res.status(400).json({ ok: false, error: "coaAccountId is required", ts: ts() });
    const note = typeof body["note"] === "string" ? body["note"].trim() || null : null;

    // 1. Resolve entity UUID
    let entityId: string;
    try {
      const resolved = await getCachedEntityId(entitySlug);
      if (!resolved)
        return res.status(404).json({ ok: false, error: "Entity not found", ts: ts() });
      entityId = resolved;
    } catch (err) {
      req.log.error({ err }, "[plaid] category entity-resolution failed");
      return res.status(503).json({ ok: false, error: "Failed to resolve entity", ts: ts() });
    }

    // 2. Verify transaction belongs to entity — before any write
    const txCheck = await verifyTransactionEntity(txId, entitySlug).catch((err) => {
      req.log.error({ err }, "[plaid] category transaction-check failed");
      return "error" as const;
    });
    if (txCheck === "error")        return res.status(500).json({ ok: false, error: "Failed to verify transaction", ts: ts() });
    if (txCheck === "not_found")    return res.status(404).json({ ok: false, error: "Transaction not found", ts: ts() });
    if (txCheck === "wrong_entity") return res.status(403).json({ ok: false, error: "Transaction does not belong to this entity", ts: ts() });

    // 3. Verify COA account against authoritative Core — ignore client-provided name/type
    let coaName: string | null;
    let coaType: string | null;
    try {
      const accounts = await getAllAccounts(entityId);
      const acct = accounts.find((a) => a.id === coaAccountId);
      if (!acct)
        return res.status(400).json({ ok: false, error: "Chart of Accounts account not found for this entity", ts: ts() });
      coaName = acct.name ?? null;
      coaType = acct.accountType ?? null;
    } catch (err) {
      req.log.error({ err }, "[plaid] category coa-lookup failed");
      return res.status(503).json({ ok: false, error: "Failed to verify Chart of Accounts account", ts: ts() });
    }

    // 4. Upsert — only after both ownership checks pass
    try {
      const saved = await upsertCategory({
        plaidTransactionId: txId,
        entitySlug,
        coaAccountId,
        coaAccountName: coaName,
        coaAccountType: coaType,
        categorizedBy:  req.session.user!.id,
        note,
      });
      return res.json({ ok: true, data: saved, ts: ts() });
    } catch (err) {
      req.log.error({ err }, "[plaid] upsert-category failed");
      return res.status(500).json({ ok: false, error: "Failed to save category", ts: ts() });
    }
  },
);

// ─── POST /api/plaid/disconnect/:connectionId ─────────────────────────────────

router.post(
  "/plaid/disconnect/:connectionId",
  requireAuth,
  async (req, res) => {
    if (!canManageBanking(req.session.user!)) {
      res.status(403).json({ ok: false, error: "Only admin or CFO can disconnect accounts", ts: ts() });
      return;
    }

    const connectionId = req.params["connectionId"];

    // Require entitySlug so we can verify ownership before disconnecting.
    // Without this any canManageBanking user could disconnect any entity's connection.
    let entitySlug: string;
    try {
      entitySlug = validateEntitySlug(
        (req.body as Record<string, unknown> | undefined)?.["entitySlug"] ?? req.query["entitySlug"],
      );
    } catch {
      res.status(400).json({ ok: false, error: "entitySlug required and must be a valid entity", ts: ts() });
      return;
    }

    try {
      const itemRes = await query<Record<string, unknown>>(
        `SELECT access_token_encrypted, access_token_iv, access_token_tag, entity_slug
         FROM plaid_items WHERE plaid_item_id = $1`,
        [connectionId],
      );

      if (itemRes.rows.length === 0) {
        res.status(404).json({ ok: false, error: "Connection not found", ts: ts() });
        return;
      }

      // Ownership check — item must belong to the entity the caller declared.
      const itemEntitySlug = String(itemRes.rows[0]!["entity_slug"] ?? "");
      if (itemEntitySlug !== entitySlug) {
        req.log.warn({ connectionId, callerEntitySlug: entitySlug, itemEntitySlug }, "[plaid] disconnect entity mismatch");
        res.status(403).json({ ok: false, error: "Connection does not belong to the specified entity", ts: ts() });
        return;
      }

      const row = itemRes.rows[0]!;
      try {
        const accessToken = decryptAccessToken(
          String(row["access_token_encrypted"]),
          String(row["access_token_iv"]),
          String(row["access_token_tag"]),
        );
        await plaidClient.itemRemove({ access_token: accessToken });
      } catch (revokeErr) {
        req.log.warn({ err: revokeErr }, "[plaid] Token revocation failed — marking disconnected anyway");
      }
      await query(
        `UPDATE plaid_items SET status = 'disconnected', updated_at = NOW() WHERE plaid_item_id = $1`,
        [connectionId],
      );
      await query(
        `UPDATE plaid_accounts SET status = 'closed', updated_at = NOW() WHERE plaid_item_id = $1`,
        [connectionId],
      );

      res.json({ ok: true, data: { message: "Disconnected" }, ts: ts() });
    } catch (err) {
      req.log.error({ err }, "[plaid] disconnect failed");
      res.status(500).json({ ok: false, error: "Disconnect failed", ts: ts() });
    }
  },
);

// ─── POST /api/plaid/deletion-request ────────────────────────────────────────

router.post("/plaid/deletion-request", requireAuth, (req, res) => {
  const user = req.session.user!;
  const body = req.body as Record<string, unknown>;
  req.log.info({ userEmail: user.email, requestType: body["requestType"] }, "Data deletion request received");
  res.json({
    ok: true,
    data: { message: "Deletion request received. An administrator will process it within 30 days." },
    ts: ts(),
  });
});

export default router;
