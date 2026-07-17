/**
 * Report Engine — builder.
 *
 * Assembles a BuiltReport from live data for a given ReportRequest + template.
 * The builder has no knowledge of output format — that is entirely the
 * renderer's job (see renderer.ts). This keeps the report data model
 * pluggable: adding a PDF/Excel/HTML renderer later never touches this file.
 */

import {
  getPortfolioSummary,
  getValidationSummary,
  getDataFreshness,
  getEntityMetrics,
  getEntityAnomalies,
  getEntityFinancials,
  getEntityCustomers,
  getEntityVendors,
} from "../lib/dataSource";
import { RulesEngine } from "../rules/engine";
import { generateBriefing } from "../ai/briefing";
import { combineSources, type DataSourceKind } from "../lib/sourceTracker";
import { ENTITY_SLUGS, type EntitySlug } from "../lib/types";
import { ENTITY_DEFINITIONS } from "../lib/entities";
import { REPORT_TEMPLATES, type ReportTemplate, type ReportOutputFormat } from "./templates";

export type ReportRequest = {
  template: string;
  entities: EntitySlug[] | "all";
  period: string;
  format: ReportOutputFormat;
};

export type ReportBranding = {
  mode: "single" | "consolidated";
  primaryEntity?: {
    slug: EntitySlug;
    name: string;
    logoPath: string | null;
    primaryColor: string;
  };
  entities: { slug: EntitySlug; name: string; logoPath: string | null }[];
  financeosBranding: boolean;
};

export type BuiltReport = {
  id: string;
  template: ReportTemplate;
  request: ReportRequest;
  branding: ReportBranding;
  generatedAt: string;
  period: string;
  /** Worst-case source (mock > cache > live) of all data in the report. */
  source: DataSourceKind;
  sections: Record<string, unknown>;
  metadata: {
    entityCount: number;
    dataFreshness: string;
    confidenceScore: number;
  };
};

function isEntitySlug(value: string): value is EntitySlug {
  return (ENTITY_SLUGS as readonly string[]).includes(value);
}

function resolveEntities(entities: EntitySlug[] | "all"): EntitySlug[] {
  if (entities === "all") return [...ENTITY_SLUGS];

  const resolved: EntitySlug[] = [];
  for (const slug of entities) {
    if (!isEntitySlug(slug)) {
      throw new Error(`Unknown entity slug: "${slug}"`);
    }
    resolved.push(slug);
  }
  return resolved;
}

function buildBranding(resolvedEntities: EntitySlug[]): ReportBranding {
  const definitions = resolvedEntities.map((slug) => {
    const def = ENTITY_DEFINITIONS.find((e) => e.slug === slug);
    if (!def) throw new Error(`No entity definition found for slug "${slug}"`);
    return def;
  });

  if (definitions.length === 1) {
    const only = definitions[0]!;
    return {
      mode: "single",
      primaryEntity: {
        slug: only.slug,
        name: only.displayName,
        logoPath: only.logo,
        primaryColor: only.primaryColor,
      },
      entities: [{ slug: only.slug, name: only.displayName, logoPath: only.logo }],
      financeosBranding: false,
    };
  }

  return {
    mode: "consolidated",
    entities: definitions.map((d) => ({ slug: d.slug, name: d.displayName, logoPath: d.logo })),
    financeosBranding: true,
  };
}

function hasSection(template: ReportTemplate, type: string): boolean {
  return template.sections.some((s) => s.type === type);
}

export async function buildReport(request: ReportRequest): Promise<BuiltReport> {
  const template = REPORT_TEMPLATES.find((t) => t.id === request.template);
  if (!template) {
    throw new Error(`Unknown report template: "${request.template}"`);
  }
  if (!template.enabled) {
    throw new Error(`Report template "${request.template}" is disabled`);
  }

  const resolvedEntities = resolveEntities(request.entities);

  const freshnessResult = await getDataFreshness();
  const freshness = freshnessResult.data;

  const needsArAp = hasSection(template, "ar_ap");

  const [portfolioResult, validationResult, briefing, alertsResult, metricsResults, anomaliesResults, financialsResults, customersResults, vendorsResults] =
    await Promise.all([
      getPortfolioSummary(),
      getValidationSummary(),
      generateBriefing(),
      RulesEngine.runWithSource(),
      Promise.all(resolvedEntities.map((slug) => getEntityMetrics(slug))),
      Promise.all(resolvedEntities.map((slug) => getEntityAnomalies(slug))),
      Promise.all(resolvedEntities.map((slug) => getEntityFinancials(slug, freshness.data_as_of))),
      needsArAp
        ? Promise.all(resolvedEntities.map((slug) => getEntityCustomers(slug, freshness.data_as_of)))
        : Promise.resolve(resolvedEntities.map(() => ({ data: null, source: "cache" as const }))),
      needsArAp
        ? Promise.all(resolvedEntities.map((slug) => getEntityVendors(slug, freshness.data_as_of)))
        : Promise.resolve(resolvedEntities.map(() => ({ data: null, source: "cache" as const }))),
    ]);

  const portfolio = portfolioResult.data;
  const validation = validationResult.data;
  const alerts = alertsResult.alerts;
  const metricsList = metricsResults.map((r) => r.data);
  const anomaliesList = anomaliesResults.map((r) => r.data);
  const financialsList = financialsResults.map((r) => r.data);
  const customersList = customersResults.map((r) => r.data);
  const vendorsList = vendorsResults.map((r) => r.data);

  const source = combineSources([
    freshnessResult.source,
    portfolioResult.source,
    validationResult.source,
    alertsResult.source,
    ...metricsResults.map((r) => r.source),
    ...anomaliesResults.map((r) => r.source),
    ...financialsResults.map((r) => r.source),
    ...(needsArAp ? customersResults.map((r) => r.source) : []),
    ...(needsArAp ? vendorsResults.map((r) => r.source) : []),
  ]);

  const entitySet = new Set<string>(resolvedEntities);
  const scopedAlerts = alerts.filter((a) => {
    const def = ENTITY_DEFINITIONS.find((e) => e.displayName === a.entity);
    return def ? entitySet.has(def.slug) : false;
  });

  const branding = buildBranding(resolvedEntities);

  const sections: Record<string, unknown> = {};

  if (hasSection(template, "executive_summary")) {
    sections["executive_summary"] = {
      greeting: briefing.greeting,
      executiveSummary: briefing.executiveSummary,
      generatedAt: briefing.generatedAt,
    };
  }

  if (hasSection(template, "portfolio_kpis")) {
    sections["portfolio_kpis"] = { portfolio };
  }

  if (hasSection(template, "entity_summary")) {
    sections["entity_summary"] = Object.fromEntries(
      resolvedEntities.map((slug, i) => [
        slug,
        { metrics: metricsList[i], anomalies: anomaliesList[i] },
      ]),
    );
  }

  if (hasSection(template, "financials")) {
    sections["financials"] = Object.fromEntries(
      resolvedEntities.map((slug, i) => [slug, financialsList[i]]),
    );
  }

  if (hasSection(template, "ar_ap")) {
    sections["ar_ap"] = Object.fromEntries(
      resolvedEntities.map((slug, i) => [
        slug,
        { customers: customersList[i] ?? null, vendors: vendorsList[i] ?? null },
      ]),
    );
  }

  if (hasSection(template, "alerts")) {
    sections["alerts"] = scopedAlerts;
  }

  if (hasSection(template, "recommendations")) {
    sections["recommendations"] = {
      priorities: briefing.priorities,
      opportunities: briefing.opportunities,
    };
  }

  if (hasSection(template, "validation")) {
    sections["validation"] = { summary: validation, freshness };
  }

  if (hasSection(template, "appendix")) {
    sections["appendix"] = {
      dataFreshness: freshness,
      pipeline_run: portfolio.pipeline_run,
      entity_count: resolvedEntities.length,
      generated_at: new Date().toISOString(),
    };
  }

  return {
    id: `report-${template.id}-${Date.now()}`,
    template,
    request,
    branding,
    generatedAt: new Date().toISOString(),
    period: request.period,
    source,
    sections,
    metadata: {
      entityCount: resolvedEntities.length,
      dataFreshness: freshness.data_as_of,
      confidenceScore: briefing.confidenceScore,
    },
  };
}
