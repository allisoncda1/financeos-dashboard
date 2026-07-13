import { Router, type IRouter } from "express";
import { REPORT_TEMPLATES, type ReportOutputFormat } from "../reports/templates";
import { generateReport } from "../reports/engine";
import type { EntitySlug } from "../lib/types";
import { ENTITY_SLUGS } from "../lib/types";
import { requirePermission } from "../auth/permissions";
import { ReportHistoryService } from "../db";

const router: IRouter = Router();

/** Replaces spaces/special chars with hyphens, lowercases, caps at 60 chars. */
function sanitizeFilename(raw: string): string {
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized.slice(0, 60) || "report";
}

/**
 * Strips URLs, connection strings, and file paths from an error message
 * before persisting to the DB. Takes only the first line and caps at 200 chars.
 */
export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const clean = raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/postgresql:\/\/\S+/gi, "[connection-string]")
    .replace(/postgres:\/\/\S+/gi, "[connection-string]")
    .replace(/\/(home|Users|var|tmp|etc|usr|opt|app)\S*/g, "[path]")
    .split("\n")[0]!
    .trim()
    .slice(0, 200);
  return clean || "Report generation failed";
}

// GET /api/reports — list available templates (metadata only)
router.get("/reports", (_req, res) => {
  try {
    const data = REPORT_TEMPLATES.map(({ id, name, description, defaultEntities, supportedFormats, enabled }) => ({
      id,
      name,
      description,
      defaultEntities,
      supportedFormats,
      enabled,
    }));
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load report templates",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/reports/history — report generation history (requires "reports" permission)
// Optional ?slug=<entity_slug> filters to reports that included that entity.
// Optional ?limit=<n> (max 200, default 50) and ?offset=<n> for pagination.
// Note: generated file artifacts are NOT stored — re-download is not available.
router.get("/reports/history", requirePermission("reports"), async (req, res) => {
  try {
    const slug = typeof req.query["slug"] === "string" ? req.query["slug"] : undefined;

    const rawLimit  = req.query["limit"]  ? Number(req.query["limit"])  : 50;
    const rawOffset = req.query["offset"] ? Number(req.query["offset"]) : 0;

    if (!Number.isFinite(rawLimit) || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
      res.status(400).json({ ok: false, error: "limit must be an integer between 1 and 200", ts: new Date().toISOString() });
      return;
    }
    if (!Number.isFinite(rawOffset) || !Number.isInteger(rawOffset) || rawOffset < 0) {
      res.status(400).json({ ok: false, error: "offset must be a non-negative integer", ts: new Date().toISOString() });
      return;
    }

    if (slug && !(ENTITY_SLUGS as readonly string[]).includes(slug)) {
      res.status(400).json({
        ok: false,
        error: `Unknown entity slug "${slug}"`,
        ts: new Date().toISOString(),
      });
      return;
    }

    const data = await ReportHistoryService.listReportHistory({ slug, limit: rawLimit, offset: rawOffset });
    res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load report history",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/reports/:template — single template definition
// Must be registered AFTER /reports/history to prevent "history" matching :template.
router.get("/reports/:template", (req, res) => {
  try {
    const template = REPORT_TEMPLATES.find((t) => t.id === req.params["template"]);
    if (!template) {
      res.status(404).json({
        ok: false,
        error: `Report template "${req.params["template"]}" not found`,
        ts: new Date().toISOString(),
      });
      return;
    }
    res.json({ ok: true, data: template, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load report template",
      ts: new Date().toISOString(),
    });
  }
});

function isEntitySlug(value: unknown): value is EntitySlug {
  return typeof value === "string" && (ENTITY_SLUGS as readonly string[]).includes(value);
}

// POST /api/reports/generate — build + render a report
router.post("/reports/generate", requirePermission("reports"), async (req, res) => {
  const requestedBy = req.session?.user?.email ?? null;

  const body = req.body as {
    template?: unknown;
    entities?: unknown;
    period?: unknown;
    format?: unknown;
  };

  // Validate inputs upfront. Failures here produce no history row because
  // we don't yet have a complete set of validated fields to record.
  if (typeof body.template !== "string") {
    res.status(400).json({ ok: false, error: "`template` is required and must be a string", ts: new Date().toISOString() });
    return;
  }
  if (typeof body.period !== "string") {
    res.status(400).json({ ok: false, error: "`period` is required and must be a string", ts: new Date().toISOString() });
    return;
  }
  const format = body.format;
  if (format !== "json" && format !== "pdf" && format !== "excel" && format !== "html") {
    res.status(400).json({ ok: false, error: '`format` must be one of "json", "pdf", "excel", "html"', ts: new Date().toISOString() });
    return;
  }
  const fileExtension = format === "excel" ? "xlsx" : format;

  let entities: EntitySlug[] | "all";
  if (body.entities === "all") {
    entities = "all";
  } else if (Array.isArray(body.entities) && body.entities.every(isEntitySlug)) {
    entities = body.entities;
  } else {
    res.status(400).json({ ok: false, error: '`entities` must be "all" or an array of valid entity slugs', ts: new Date().toISOString() });
    return;
  }

  const template = body.template;
  const period = body.period;
  const entitySlugsArray: string[] = entities === "all" ? [...ENTITY_SLUGS] : entities;

  try {
    const { report, output } = await generateReport({
      template,
      entities,
      period,
      format: format as ReportOutputFormat,
    });

    // Await the history write before responding. A write failure must never
    // prevent report delivery — the catch absorbs it and we continue.
    try {
      await ReportHistoryService.insertReportHistory({
        template:        report.template.id,
        title:           report.template.name,
        period:          report.period,
        format,
        entitySlugs:     entitySlugsArray,
        status:          "completed",
        source:          report.source,
        dataFreshness:   report.metadata.dataFreshness,
        entityCount:     report.metadata.entityCount,
        confidenceScore: report.metadata.confidenceScore,
        requestedBy,
        completedAt:     new Date(),
      });
    } catch (histErr) {
      req.log.error({ err: histErr }, "Failed to persist report history — report already delivered");
    }

    if (format === "json") {
      res.json({
        ok: true,
        data: {
          reportId: report.id,
          template: report.template,
          generatedAt: report.generatedAt,
          branding: report.branding,
          sections: report.sections,
          metadata: report.metadata,
          output,
        },
        source: report.source,
        ts: new Date().toISOString(),
      });
      return;
    }

    const filename = sanitizeFilename(`financeos-report-${report.template.id}-${report.period}`);
    const contentTypeByFormat: Record<string, string> = {
      html:  "text/html; charset=utf-8",
      pdf:   "application/pdf",
      excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    res.setHeader("Content-Type", contentTypeByFormat[format] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.${fileExtension}"`);
    res.setHeader("X-Report-Source", report.source);
    res.send(output);
  } catch (err) {
    // Generation failed. format and template are already validated above, so
    // we can record a clean history row with a sanitized error message.
    const errorMessage = sanitizeErrorMessage(err);

    try {
      await ReportHistoryService.insertReportHistory({
        template,
        title:       "Failed report",
        period,
        format,
        entitySlugs: entitySlugsArray,
        status:      "failed",
        requestedBy,
        errorMessage,
        completedAt: new Date(),
      });
    } catch (histErr) {
      req.log.warn({ err: histErr }, "Failed to persist failure record");
    }

    res.status(400).json({
      ok: false,
      error: errorMessage,
      ts: new Date().toISOString(),
    });
  }
});

export default router;
