import { Router, type IRouter } from "express";
import { ENTITY_SLUGS } from "../lib/types";
import type { EntitySlug } from "../lib/types";
import { BudgetService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
import {
  transformEntityBudget,
  transformBudgetVsActual,
  transformPortfolioBudget,
} from "../transformers/budgetNeon";

const router: IRouter = Router();

const CURRENT_YEAR = () => new Date().getFullYear();

function isEntitySlug(s: string): s is EntitySlug {
  return (ENTITY_SLUGS as readonly string[]).includes(s);
}

// ── GET /api/budget/portfolio ─────────────────────────────────────────────────
// Must be registered BEFORE /api/budget/:slug to prevent "portfolio" matching :slug.

router.get("/budget/portfolio", async (req, res) => {
  const year = Number(req.query["year"]) || CURRENT_YEAR();
  try {
    const data = await transformPortfolioBudget(year);
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load portfolio budget");
    res.status(500).json({ ok: false, error: "Failed to load portfolio budget", ts: new Date().toISOString() });
  }
});

// ── GET /api/budget/:slug ─────────────────────────────────────────────────────

router.get("/budget/:slug", async (req, res) => {
  const slug = req.params["slug"]!;
  if (!isEntitySlug(slug)) {
    res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
    return;
  }
  const year = Number(req.query["year"]) || CURRENT_YEAR();
  try {
    const data = await transformEntityBudget(slug, year);
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, `Failed to load budget for ${slug}`);
    res.status(500).json({ ok: false, error: "Failed to load entity budget", ts: new Date().toISOString() });
  }
});

// ── GET /api/budget/:slug/vs-actual ──────────────────────────────────────────

router.get("/budget/:slug/vs-actual", async (req, res) => {
  const slug = req.params["slug"]!;
  if (!isEntitySlug(slug)) {
    res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
    return;
  }
  const year = Number(req.query["year"]) || CURRENT_YEAR();
  try {
    const data = await transformBudgetVsActual(slug, year);
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, `Failed to load budget vs actual for ${slug}`);
    res.status(500).json({ ok: false, error: "Failed to load budget vs actual", ts: new Date().toISOString() });
  }
});

// ── GET /api/budget/:slug/annual ──────────────────────────────────────────────

router.get("/budget/:slug/annual", async (req, res) => {
  const slug = req.params["slug"]!;
  if (!isEntitySlug(slug)) {
    res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
    return;
  }
  const year = Number(req.query["year"]) || CURRENT_YEAR();
  try {
    const entityId = await getCachedEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in Neon`, ts: new Date().toISOString() });
      return;
    }
    const row = await BudgetService.getAnnualBudget(entityId, year);
    const data = row
      ? {
          entity_slug: slug, year,
          revenue_target:    row.revenueTarget,
          cogs_target:       row.cogsTarget,
          opex_target:       row.opexTarget,
          net_income_target: row.netIncomeTarget,
          period_start:      row.periodStart,
          period_end:        row.periodEnd,
        }
      : null;
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, `Failed to load annual budget for ${slug}`);
    res.status(500).json({ ok: false, error: "Failed to load annual budget", ts: new Date().toISOString() });
  }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNullableNumber(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

function validatePeriodInput(body: unknown): { ok: true; data: PeriodInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (!b["period_start"] || !DATE_RE.test(String(b["period_start"]))) {
    return { ok: false, error: "period_start must be YYYY-MM-DD" };
  }
  if (!b["period_end"] || !DATE_RE.test(String(b["period_end"]))) {
    return { ok: false, error: "period_end must be YYYY-MM-DD" };
  }
  const periodType = b["period_type"] ?? "month";
  if (periodType !== "month" && periodType !== "annual") {
    return { ok: false, error: "period_type must be 'month' or 'annual'" };
  }
  for (const k of ["revenue_target", "cogs_target", "opex_target"] as const) {
    if (b[k] !== undefined && !isNullableNumber(b[k])) {
      return { ok: false, error: `${k} must be a non-negative number or null` };
    }
    if (typeof b[k] === "number" && (b[k] as number) < 0) {
      return { ok: false, error: `${k} must be >= 0` };
    }
  }
  if (b["net_income_target"] !== undefined && !isNullableNumber(b["net_income_target"])) {
    return { ok: false, error: "net_income_target must be a number or null" };
  }
  return {
    ok: true,
    data: {
      period_start:      String(b["period_start"]),
      period_end:        String(b["period_end"]),
      period_type:       periodType as "month" | "annual",
      revenue_target:    b["revenue_target"]    !== undefined ? (b["revenue_target"]    as number | null) : null,
      cogs_target:       b["cogs_target"]       !== undefined ? (b["cogs_target"]       as number | null) : null,
      opex_target:       b["opex_target"]       !== undefined ? (b["opex_target"]       as number | null) : null,
      net_income_target: b["net_income_target"] !== undefined ? (b["net_income_target"] as number | null) : null,
    },
  };
}

type PeriodInput = {
  period_start: string;
  period_end: string;
  period_type: "month" | "annual";
  revenue_target: number | null;
  cogs_target: number | null;
  opex_target: number | null;
  net_income_target: number | null;
};

// ── PUT /api/budget/:slug/period ──────────────────────────────────────────────

router.put("/budget/:slug/period", async (req, res) => {
  const slug = req.params["slug"]!;
  if (!isEntitySlug(slug)) {
    res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
    return;
  }

  const validated = validatePeriodInput(req.body);
  if (!validated.ok) {
    res.status(400).json({ ok: false, error: validated.error, ts: new Date().toISOString() });
    return;
  }

  const input = validated.data;
  try {
    const entityId = await getCachedEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in Neon`, ts: new Date().toISOString() });
      return;
    }

    const row = await BudgetService.upsertBudgetPeriod(entityId, {
      periodType:      input.period_type,
      periodStart:     input.period_start,
      periodEnd:       input.period_end,
      revenueTarget:   input.revenue_target   ?? null,
      cogsTarget:      input.cogs_target      ?? null,
      opexTarget:      input.opex_target      ?? null,
      netIncomeTarget: input.net_income_target ?? null,
    });

    res.json({
      ok: true,
      data: {
        entity_slug:       slug,
        period_start:      row.periodStart,
        period_end:        row.periodEnd,
        period_type:       row.periodType,
        revenue_target:    row.revenueTarget,
        cogs_target:       row.cogsTarget,
        opex_target:       row.opexTarget,
        net_income_target: row.netIncomeTarget,
        updated_at:        row.updatedAt.toISOString(),
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, `Failed to upsert budget period for ${slug}`);
    res.status(500).json({ ok: false, error: "Failed to save budget period", ts: new Date().toISOString() });
  }
});

function validateAnnualInput(body: unknown): { ok: true; data: AnnualInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const year = Number(b["year"]);
  if (!Number.isInteger(year) || year < 2020 || year > 2099) {
    return { ok: false, error: "year must be an integer between 2020 and 2099" };
  }
  for (const k of ["revenue_target", "cogs_target", "opex_target"] as const) {
    if (b[k] !== undefined && !isNullableNumber(b[k])) {
      return { ok: false, error: `${k} must be a non-negative number or null` };
    }
    if (typeof b[k] === "number" && (b[k] as number) < 0) {
      return { ok: false, error: `${k} must be >= 0` };
    }
  }
  if (b["net_income_target"] !== undefined && !isNullableNumber(b["net_income_target"])) {
    return { ok: false, error: "net_income_target must be a number or null" };
  }
  return {
    ok: true,
    data: {
      year,
      revenue_target:    b["revenue_target"]    !== undefined ? (b["revenue_target"]    as number | null) : null,
      cogs_target:       b["cogs_target"]       !== undefined ? (b["cogs_target"]       as number | null) : null,
      opex_target:       b["opex_target"]       !== undefined ? (b["opex_target"]       as number | null) : null,
      net_income_target: b["net_income_target"] !== undefined ? (b["net_income_target"] as number | null) : null,
    },
  };
}

type AnnualInput = {
  year: number;
  revenue_target: number | null;
  cogs_target: number | null;
  opex_target: number | null;
  net_income_target: number | null;
};

// ── PUT /api/budget/:slug/annual ──────────────────────────────────────────────

router.put("/budget/:slug/annual", async (req, res) => {
  const slug = req.params["slug"]!;
  if (!isEntitySlug(slug)) {
    res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
    return;
  }

  const validated = validateAnnualInput(req.body);
  if (!validated.ok) {
    res.status(400).json({ ok: false, error: validated.error, ts: new Date().toISOString() });
    return;
  }

  const input = validated.data;
  try {
    const entityId = await getCachedEntityId(slug);
    if (!entityId) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found in Neon`, ts: new Date().toISOString() });
      return;
    }

    const row = await BudgetService.upsertBudgetPeriod(entityId, {
      periodType:      "annual",
      periodStart:     `${input.year}-01-01`,
      periodEnd:       `${input.year}-12-31`,
      revenueTarget:   input.revenue_target   ?? null,
      cogsTarget:      input.cogs_target      ?? null,
      opexTarget:      input.opex_target      ?? null,
      netIncomeTarget: input.net_income_target ?? null,
    });

    res.json({
      ok: true,
      data: {
        entity_slug:       slug,
        year:              input.year,
        period_start:      row.periodStart,
        period_end:        row.periodEnd,
        revenue_target:    row.revenueTarget,
        cogs_target:       row.cogsTarget,
        opex_target:       row.opexTarget,
        net_income_target: row.netIncomeTarget,
        updated_at:        row.updatedAt.toISOString(),
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, `Failed to upsert annual budget for ${slug}`);
    res.status(500).json({ ok: false, error: "Failed to save annual budget", ts: new Date().toISOString() });
  }
});

export default router;
