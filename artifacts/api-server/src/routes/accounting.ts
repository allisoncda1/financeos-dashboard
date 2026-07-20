/**
 * Accounting module API routes.
 *
 * These endpoints serve the /accounting/* pages with authoritative Neon data.
 * All reads are from CORE_DATABASE_URL (read-only Neon Core).
 *
 * Security model:
 *  - All routes are behind the global requireAuth gate in routes/index.ts.
 *  - Each resource additionally requires the narrowest applicable permission:
 *      customers  → "customers"
 *      vendors    → "vendors"
 *      invoices   → "financials"
 *      accounts   → "financials"
 *      transactions → "banking"
 *      bills      → "vendors"
 *  - Slug guard: slug must be a known ENTITY_SLUGS value (case-insensitive).
 *  - Entity isolation: slug → getCachedEntityId (lowercase normalised) → UUID
 *    on every request; never cross-entity data.
 *
 * Data lineage (Python → Neon → Dashboard):
 *  QBO API → Python FinanceOS Core pipeline → Neon tables → these endpoints.
 *  All numeric fields are stored as Drizzle `numeric` strings; the route maps
 *  them to JavaScript numbers via parseNumeric before serialising.
 *
 * Transaction note:
 *  The /transactions endpoint returns rows from the `transactions` table which
 *  holds QBO bank/payment transactions (not a full double-entry GL journal).
 *  Amounts are unsigned magnitudes; direction is encoded in `transactionType`.
 *  The endpoint is scoped to bank activity, not a complete general ledger.
 */

import { Router, type IRouter } from "express";
import { getCachedEntityId } from "../services/entityCache";
import { requirePermission } from "../auth/permissions";
import { ENTITY_SLUGS } from "../lib/mockData";
import { getCustomers } from "../db/customers";
import { getVendors } from "../db/vendors";
import { getAllInvoices } from "../db/invoices";
import { getAllAccounts } from "../db/accounts";
import { getRecentTransactions } from "../db/transactions";
import { getOpenBills } from "../db/bills";

const router: IRouter = Router();

// ─── Slug guard (case-insensitive) ───────────────────────────────────────────

const VALID_SLUG_LOWER = new Set(
  (ENTITY_SLUGS as readonly string[]).map((s) => s.toLowerCase()),
);

function isValidSlug(slug: string): boolean {
  return VALID_SLUG_LOWER.has(slug.toLowerCase());
}

async function resolveEntityId(slug: string): Promise<string | null> {
  // getCachedEntityId already lowercases the slug before lookup.
  return getCachedEntityId(slug);
}

// ─── GET /api/accounting/:slug/customers ─────────────────────────────────────

router.get(
  "/accounting/:slug/customers",
  requirePermission("customers"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    try {
      const rows = await getCustomers(entityId);
      const data = rows.map((r) => ({
        id:          r.id,
        qboId:       r.qboId,
        displayName: r.displayName,
        email:       r.email ?? null,
        phone:       r.phone ?? null,
        // balance is the QBO-synced open AR balance for this customer.
        // It reflects payment allocations as computed by QBO, not re-derived here.
        balance:     r.balance,
        currency:    r.currency ?? "USD",
        isActive:    r.isActive,
        syncedAt:    r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/customers failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load customers" });
    }
  },
);

// ─── GET /api/accounting/:slug/vendors ───────────────────────────────────────

router.get(
  "/accounting/:slug/vendors",
  requirePermission("vendors"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    try {
      const rows = await getVendors(entityId);
      const data = rows.map((r) => ({
        id:          r.id,
        qboId:       r.qboId,
        displayName: r.displayName,
        email:       r.email ?? null,
        // balance is the QBO-synced open AP balance for this vendor.
        balance:     r.balance,
        currency:    r.currency ?? "USD",
        isActive:    r.isActive,
        syncedAt:    r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/vendors failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load vendors" });
    }
  },
);

// ─── GET /api/accounting/:slug/invoices ──────────────────────────────────────

router.get(
  "/accounting/:slug/invoices",
  requirePermission("financials"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    const limitParam = parseInt(String(req.query["limit"] ?? "200"), 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

    try {
      const rows = await getAllInvoices(entityId, limit);
      const data = rows.map((r) => ({
        id:           r.id,
        qboId:        r.qboId,
        customerName: r.customerName ?? null,
        invoiceDate:  r.invoiceDate ?? null,
        dueDate:      r.dueDate ?? null,
        // amount = original invoice total; balance = remaining after QBO-tracked payments.
        // Both reflect QBO authoritative values, not re-computed from payment_allocations here.
        amount:       r.amount,
        balance:      r.balance,
        status:       r.status ?? null,
        daysOverdue:  r.daysOverdue ?? null,
        currency:     r.currency ?? "USD",
        memo:         r.memo ?? null,
        syncedAt:     r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/invoices failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load invoices" });
    }
  },
);

// ─── GET /api/accounting/:slug/accounts ─────────────────────────────────────

router.get(
  "/accounting/:slug/accounts",
  requirePermission("financials"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    try {
      const rows = await getAllAccounts(entityId);
      const data = rows.map((r) => ({
        id:                 r.id,
        qboId:              r.qboId,
        name:               r.name,
        fullyQualifiedName: r.fullyQualifiedName ?? null,
        accountType:        r.accountType,
        accountSubtype:     r.accountSubtype ?? null,
        classification:     r.classification ?? null,
        currentBalance:     r.currentBalance,
        currency:           r.currency ?? "USD",
        isActive:           r.isActive,
        isSubAccount:       r.isSubAccount ?? false,
        parentQboId:        r.parentQboId ?? null,
        syncedAt:           r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/accounts failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load chart of accounts" });
    }
  },
);

// ─── GET /api/accounting/:slug/transactions ──────────────────────────────────
//
// Returns bank/payment transactions from the QBO-synced `transactions` table.
// This is NOT a complete double-entry general ledger — it is bank activity and
// QBO payment records. Amounts are unsigned magnitudes; directionality is encoded
// in `transactionType` (e.g. "Payment" = money in, "Purchase" = money out).
// Do not use this endpoint to derive accounting balances or P&L.

router.get(
  "/accounting/:slug/transactions",
  requirePermission("banking"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    const limitParam = parseInt(String(req.query["limit"] ?? "100"), 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100;

    try {
      const rows = await getRecentTransactions(entityId, limit);
      const data = rows.map((r) => ({
        id:              r.id,
        qboId:           r.qboId ?? null,
        accountId:       r.accountId ?? null,
        transactionDate: r.transactionDate ?? null,
        transactionType: r.transactionType ?? null,
        memo:            r.memo ?? null,
        // amount is an unsigned magnitude; direction is implied by transactionType.
        // Null DB amount stays null — missing data must not be silently shown as 0.
        amount:          r.amount ?? null,
        currency:        r.currency ?? "USD",
        category:        r.category ?? null,
        isReconciled:    r.isReconciled ?? false,
        syncedAt:        r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/transactions failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load transactions" });
    }
  },
);

// ─── GET /api/accounting/:slug/bills ─────────────────────────────────────────

router.get(
  "/accounting/:slug/bills",
  requirePermission("vendors"),
  async (req, res) => {
    const slug = req.params["slug"] as string;
    if (!isValidSlug(slug)) {
      res.status(404).json({ ok: false, error: `Unknown entity slug "${slug}"` });
      return;
    }

    const entityId = await resolveEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in database` });
      return;
    }

    try {
      const rows = await getOpenBills(entityId);
      const data = rows.map((r) => ({
        id:          r.id,
        qboId:       r.qboId,
        vendorName:  r.vendorName ?? null,
        billDate:    r.billDate ?? null,
        dueDate:     r.dueDate ?? null,
        // amount = original bill total; balance = remaining open AP (QBO-synced).
        amount:      r.amount,
        balance:     r.balance,
        status:      r.status ?? null,
        daysOverdue: r.daysOverdue ?? null,
        currency:    r.currency ?? "USD",
        memo:        r.memo ?? null,
        syncedAt:    r.syncedAt?.toISOString() ?? null,
      }));

      res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
    } catch (err) {
      req.log.error({ err }, `accounting/bills failed for ${slug}`);
      res.status(500).json({ ok: false, error: "Failed to load bills" });
    }
  },
);

export default router;
