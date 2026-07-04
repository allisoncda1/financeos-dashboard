import { Router, type IRouter } from "express";
import { REPORT_TEMPLATES, type ReportOutputFormat } from "../reports/templates";
import { generateReport } from "../reports/engine";
import type { EntitySlug } from "../lib/types";
import { ENTITY_SLUGS } from "../lib/types";
import { requirePermission } from "../auth/permissions";

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
    // Template catalog is static application config, not fetched data.
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load report templates",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/reports/:template — single template definition
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
    // The report model uses "excel" internally (matches ReportOutputFormat),
    // but the file extension / MIME type / filename all use "xlsx" per
    // spreadsheet convention.
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

    // Binary/text formats stream the rendered output directly — no envelope,
    // no temp files. Everything stays in-memory buffers end to end.
    const filename = sanitizeFilename(`financeos-report-${report.template.id}-${report.period}`);
    const contentTypeByFormat: Record<string, string> = {
      html: "text/html; charset=utf-8",
      pdf: "application/pdf",
      excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    res.setHeader("Content-Type", contentTypeByFormat[format] ?? "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.${fileExtension}"`,
    );
    res.setHeader("X-Report-Source", report.source);
    res.send(output);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate report",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
