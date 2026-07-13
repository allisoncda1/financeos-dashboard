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

// GET /api/reports/history — report generation history
// Optional ?slug=<entity_slug> filters to reports that included that entity.
// Optional ?limit=<n> (max 200, default 50) and ?offset=<n> for pagination.
router.get("/reports/history", async (req, res) => {
  try {
    const slug   = typeof req.query["slug"]   === "string" ? req.query["slug"]   : undefined;
    const limit  = req.query["limit"]  ? Number(req.query["limit"])  : undefined;
    const offset = req.query["offset"] ? Number(req.query["offset"]) : undefined;

    if (slug && !(ENTITY_SLUGS as readonly string[]).includes(slug)) {
      res.status(400).json({
        ok: false,
        error: `Unknown entity slug "${slug}"`,
        ts: new Date().toISOString(),
      });
      return;
    }

    const data = await ReportHistoryService.listReportHistory({ slug, limit, offset });
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

  try {
    const body = req.body as {
      template?: unknown;
      entities?: unknown;
      period?: unknown;
      format?: unknown;
    };

    if (typeof body.template !== "string") {
      throw new Error("`template` is required and must be a string");
    }
    if (typeof body.period !== "string") {
      throw new Error("`period` is required and must be a string");
    }
    const format = body.format;
    if (format !== "json" && format !== "pdf" && format !== "excel" && format !== "html") {
      throw new Error('`format` must be one of "json", "pdf", "excel", "html"');
    }
    const fileExtension = format === "excel" ? "xlsx" : format;

    let entities: EntitySlug[] | "all";
    if (body.entities === "all") {
      entities = "all";
    } else if (Array.isArray(body.entities) && body.entities.every(isEntitySlug)) {
      entities = body.entities;
    } else {
      throw new Error('`entities` must be "all" or an array of valid entity slugs');
    }

    const { report, output } = await generateReport({
      template: body.template,
      entities,
      period: body.period,
      format: format as ReportOutputFormat,
    });

    // Persist history record. Fire-and-forget: a write failure must never prevent
    // the report from being delivered to the client.
    const entitySlugsArray: string[] =
      entities === "all" ? [...ENTITY_SLUGS] : entities;

    void ReportHistoryService.insertReportHistory({
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
    }).catch((err) => {
      req.log.error({ err }, "Failed to persist report history — report already delivered");
    });

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
    const errorMessage = err instanceof Error ? err.message : "Failed to generate report";

    // Record the failure. Non-blocking — if this also fails the original error
    // is still returned to the client and the failure is logged.
    void ReportHistoryService.insertReportHistory({
      template:    typeof (req.body as Record<string, unknown>)["template"] === "string"
        ? (req.body as Record<string, string>)["template"]!
        : "unknown",
      title:       "Failed report",
      period:      typeof (req.body as Record<string, unknown>)["period"] === "string"
        ? (req.body as Record<string, string>)["period"]!
        : "unknown",
      format:      typeof (req.body as Record<string, unknown>)["format"] === "string"
        ? (req.body as Record<string, string>)["format"]!
        : "unknown",
      entitySlugs: [],
      status:      "failed",
      requestedBy,
      errorMessage,
      completedAt: new Date(),
    }).catch(() => {/* swallow — original error takes precedence */});

    res.status(400).json({
      ok: false,
      error: errorMessage,
      ts: new Date().toISOString(),
    });
  }
});

export default router;
