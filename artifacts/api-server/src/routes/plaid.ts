/**
 * Plaid routes — Phase 1: Link, exchange, sync, accounts, transactions, webhook.
 *
 * DATABASE_URL (heliumdb) ONLY — never CORE_DATABASE_URL.
 * PLAID_TOKEN_ENCRYPTION_KEY encrypts access_tokens at rest (AES-256-GCM).
 *
 * SECURITY INVARIANTS:
 *  - access_token is encrypted immediately after exchange; plaintext is never logged or returned.
 *  - No response schema ever includes access_token, iv, tag, or encryption key.
 *  - Webhook route is public (Plaid calls it without a session); all other routes require auth.
 *  - Webhook verification is best-effort; unverified events are stored with
 *    plaid_verification_present=false rather than rejected (avoids missed syncs).
 *
 * Two routers are exported:
 *  - default export `plaidRouter`        — authenticated routes, mount after requireAuth
 *  - named export  `plaidWebhookRouter`  — public route, mount before requireAuth
 */

import { Router, json } from "express";
import { Pool } from "pg";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "../lib/plaidClient";
import { encryptAccessToken, decryptAccessToken } from "../lib/plaidEncryption";
import { requireAuth } from "../auth/middleware";
import { requirePermission } from "../auth/permissions";

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
    plaidAccountId:  String(row["plaid_account_id"] ?? ""),
    name:            row["name"] != null ? String(row["name"]) : null,
    officialName:    row["official_name"] != null ? String(row["official_name"]) : null,
    type:            row["type"] != null ? String(row["type"]) : null,
    subtype:         row["subtype"] != null ? String(row["subtype"]) : null,
    mask:            row["mask"] != null ? String(row["mask"]) : null,
    currentBalance:  row["current_balance"] != null ? Number(row["current_balance"]) : null,
    availableBalance:row["available_balance"] != null ? Number(row["available_balance"]) : null,
    isoCurrencyCode: String(row["iso_currency_code"] ?? "USD"),
    status:          String(row["status"] ?? "active"),
  };
}

// ─── Internal sync function ───────────────────────────────────────────────────

/**
 * syncTransactionsForItem — fetches all new/modified/removed transactions
 * from Plaid using the /transactions/sync endpoint and upserts them to DB.
 * Stores the updated cursor back to plaid_items.
 * Returns counts for summary reporting.
 */
async function syncTransactionsForItem(plaidItemId: string): Promise<{
  added: number;
  modified: number;
  removed: number;
}> {
  // Fetch item + encrypted token
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

    // Upsert added transactions
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

    // Upsert modified transactions
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

    // Mark removed transactions as non-pending (soft-delete per Plaid guidance)
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

  // Update cursor and last sync timestamp
  await query(
    `UPDATE plaid_items
     SET transactions_cursor = $1, last_successful_sync_at = NOW(), updated_at = NOW()
     WHERE plaid_item_id = $2`,
    [cursor ?? null, plaidItemId],
  );

  return { added: addedCount, modified: modifiedCount, removed: removedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC WEBHOOK ROUTER — mount BEFORE requireAuth in index.ts
// ═══════════════════════════════════════════════════════════════════════════

export const plaidWebhookRouter = Router();

// Raw body middleware scoped to this route only (needed for Plaid JWT verification)
plaidWebhookRouter.post(
  "/api/plaid/webhook",
  json({ type: "*/*" }),
  async (req, res) => {
    const webhookType: string = String(req.body?.webhook_type ?? "UNKNOWN");
    const webhookCode: string = String(req.body?.webhook_code ?? "UNKNOWN");
    const plaidItemId: string | null = req.body?.item_id ?? null;

    // Best-effort JWT verification using Plaid's JWK endpoint.
    // We store the result but do NOT reject unverified events —
    // sandbox webhooks may lack a signed JWT.
    let verificationPresent = false;
    const jwtHeader = req.headers["plaid-verification"];

    if (jwtHeader && typeof jwtHeader === "string") {
      try {
        // Fetch the verification key and verify the JWT
        // Plaid uses ES256 — the JWT library would verify signature here.
        // For now we confirm the header exists; full JOSE verification
        // requires the 'jose' package (Phase 2 hardening).
        verificationPresent = true;
      } catch {
        verificationPresent = false;
      }
    }

    // Store every webhook before processing — ensures audit trail even on failures
    let eventId: string | null = null;
    try {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO plaid_webhook_events
           (webhook_type, webhook_code, plaid_item_id, payload, plaid_verification_present, status)
         VALUES ($1, $2, $3, $4, $5, 'received')
         RETURNING id`,
        [
          webhookType,
          webhookCode,
          plaidItemId,
          JSON.stringify(req.body ?? {}),
          verificationPresent,
        ],
      );
      eventId = insertRes.rows[0]?.id ?? null;
    } catch (dbErr) {
      // Log failure but still return 200 to Plaid to avoid retry storms
      req.log?.error?.({ err: dbErr }, "[plaid-webhook] Failed to store webhook event");
      res.status(200).json({ ok: true, stored: false, ts: ts() });
      return;
    }

    // Trigger async sync for TRANSACTIONS/SYNC_UPDATES_AVAILABLE
    if (webhookType === "TRANSACTIONS" && webhookCode === "SYNC_UPDATES_AVAILABLE" && plaidItemId) {
      // Fire-and-forget — respond 200 immediately, sync runs in background
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
      // Non-sync webhooks: mark as processed immediately (no action needed in Phase 1)
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

// ─── POST /api/plaid/link-token ───────────────────────────────────────────────

router.post(
  "/plaid/link-token",
  requireAuth,
  requirePermission("banking"),
  async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const entitySlug = body["entitySlug"];

    if (!entitySlug || typeof entitySlug !== "string") {
      res.status(400).json({ ok: false, error: "entitySlug required", ts: ts() });
      return;
    }

    try {
      const webhookUrl = process.env["PLAID_WEBHOOK_URL"] ?? "";
      const linkRes = await plaidClient.linkTokenCreate({
        user: { client_user_id: req.session.user!.id },
        client_name: "FinanceOS",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
        webhook: webhookUrl || undefined,
        transactions: { days_requested: 730 },
      });

      // Return only link_token — never expose client_id, secret, or request_id
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
  requirePermission("banking"),
  async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const entitySlug = body["entitySlug"];
    const publicToken = body["publicToken"];
    const metadata = body["metadata"] as Record<string, unknown> | undefined;

    if (!entitySlug || typeof entitySlug !== "string") {
      res.status(400).json({ ok: false, error: "entitySlug required", ts: ts() });
      return;
    }
    if (!publicToken || typeof publicToken !== "string") {
      res.status(400).json({ ok: false, error: "publicToken required", ts: ts() });
      return;
    }

    try {
      // Exchange public token for access token
      const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
      const { access_token, item_id } = exchangeRes.data;

      // Encrypt immediately — plaintext access_token is never stored or returned
      const { encrypted, iv, tag } = encryptAccessToken(access_token);

      const institution = metadata?.["institution"] as Record<string, unknown> | undefined;
      const institutionId: string = String(institution?.["institution_id"] ?? "");
      const institutionName: string = String(institution?.["name"] ?? "");

      // Store plaid_item
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
        [entitySlug, item_id, institutionId, institutionName, encrypted, iv, tag,
         req.session.user!.email],
      );

      // Fetch accounts from Plaid
      const accountsRes = await plaidClient.accountsGet({ access_token });
      const accounts = accountsRes.data.accounts;

      // Store accounts in DB
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
            item_id,
            acct.account_id,
            entitySlug,
            acct.name ?? null,
            acct.official_name ?? null,
            acct.type ?? null,
            acct.subtype ?? null,
            acct.mask ?? null,
            acct.balances.current != null ? String(acct.balances.current) : null,
            acct.balances.available != null ? String(acct.balances.available) : null,
            acct.balances.iso_currency_code ?? "USD",
          ],
        );
      }

      // Trigger initial transaction sync (best-effort, async)
      setImmediate(() => {
        syncTransactionsForItem(item_id).catch((err) => {
          req.log.error({ err, plaidItemId: item_id }, "[plaid] Initial sync failed");
        });
      });

      // Return safe fields only — NEVER return access_token
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
  requirePermission("control"),
  async (req, res) => {
    const rawId = req.params["id"];
    const plaidItemId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!plaidItemId) {
      res.status(400).json({ ok: false, error: "item id required", ts: ts() });
      return;
    }

    try {
      const summary = await syncTransactionsForItem(plaidItemId);
      res.json({
        ok: true,
        data: { plaidItemId, ...summary },
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
  requirePermission("banking"),
  async (req, res) => {
    const entitySlug = req.query["entitySlug"] as string | undefined;
    if (!entitySlug) {
      res.status(400).json({ ok: false, error: "entitySlug query param required", ts: ts() });
      return;
    }

    try {
      const result = await query<Record<string, unknown>>(
        `SELECT pa.plaid_account_id, pa.name, pa.official_name, pa.type, pa.subtype,
                pa.mask, pa.current_balance, pa.available_balance, pa.iso_currency_code,
                pa.status, pi.institution_name, pi.plaid_item_id, pi.last_successful_sync_at
         FROM plaid_accounts pa
         JOIN plaid_items pi ON pi.plaid_item_id = pa.plaid_item_id
         WHERE pa.entity_slug = $1 AND pa.status = 'active' AND pi.status = 'active'
         ORDER BY pa.created_at ASC`,
        [entitySlug],
      );

      res.json({
        ok: true,
        data: result.rows.map((row) => ({
          ...rowToSafeAccount(row),
          institutionName: row["institution_name"] ?? null,
          plaidItemId: row["plaid_item_id"],
          lastSyncAt: row["last_successful_sync_at"] ?? null,
        })),
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
  requirePermission("banking"),
  async (req, res) => {
    const entitySlug = req.query["entitySlug"] as string | undefined;
    const accountId  = req.query["accountId"]  as string | undefined;
    const from       = req.query["from"]        as string | undefined;
    const to         = req.query["to"]          as string | undefined;
    const pageStr    = req.query["page"]        as string | undefined;
    const limitStr   = req.query["limit"]       as string | undefined;

    if (!entitySlug) {
      res.status(400).json({ ok: false, error: "entitySlug query param required", ts: ts() });
      return;
    }

    const page  = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(limitStr ?? "100", 10) || 100));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["bt.entity_slug = $1"];
    const params: unknown[] = [entitySlug];
    let paramIdx = 2;

    if (accountId) {
      conditions.push(`bt.plaid_account_id = $${paramIdx++}`);
      params.push(accountId);
    }
    if (from) {
      conditions.push(`bt.date >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`bt.date <= $${paramIdx++}`);
      params.push(to);
    }

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

// ─── Legacy consent/disconnect routes (preserved from stub) ──────────────────

import {
  PLAID_CONSENT_TEXT,
  CURRENT_PRIVACY_POLICY_VERSION,
  consentTextHash,
} from "../services/consentService";

router.get("/plaid/consent-info", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      consentText: PLAID_CONSENT_TEXT,
      consentTextHash: consentTextHash(),
    },
    ts: ts(),
  });
});

router.post("/plaid/consent", requireAuth, (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body["entityId"] || typeof body["entityId"] !== "string") {
    res.status(400).json({ ok: false, error: "entityId required", ts: ts() });
    return;
  }
  res.json({
    ok: true,
    data: {
      message: "Consent recorded.",
      consentTextHash: consentTextHash(),
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    },
    ts: ts(),
  });
});

router.post("/plaid/disconnect/:connectionId", requireAuth, requirePermission("control"), async (req, res) => {
  const connectionId = req.params["connectionId"];
  try {
    // Fetch item to get access_token for revocation
    const itemRes = await query<Record<string, unknown>>(
      `SELECT access_token_encrypted, access_token_iv, access_token_tag
       FROM plaid_items WHERE plaid_item_id = $1`,
      [connectionId],
    );
    if (itemRes.rows.length > 0) {
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
    }
    res.json({ ok: true, data: { message: "Disconnected" }, ts: ts() });
  } catch (err) {
    req.log.error({ err }, "[plaid] disconnect failed");
    res.status(500).json({ ok: false, error: "Disconnect failed", ts: ts() });
  }
});

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
