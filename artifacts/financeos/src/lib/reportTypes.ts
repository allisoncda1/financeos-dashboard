/**
 * Report Engine — frontend types.
 *
 * Mirrors the shapes returned by the api-server Report Engine
 * (artifacts/api-server/src/reports/{templates,builder}.ts). Kept as
 * loosely-typed as the backend allows since section content is
 * template-dependent (Record<string, unknown>).
 */

import type { EntitySlug } from "./types";

export type ReportOutputFormat = "json" | "pdf" | "excel" | "html";

export type ReportSectionType =
  | "executive_summary"
  | "portfolio_kpis"
  | "entity_summary"
  | "financials"
  | "alerts"
  | "recommendations"
  | "validation"
  | "appendix";

export type ReportSection = {
  id: string;
  title: string;
  type: ReportSectionType;
  includeEntities: boolean;
};

export type ReportTemplateSummary = {
  id: string;
  name: string;
  description: string;
  defaultEntities: "all" | "single";
  supportedFormats: ReportOutputFormat[];
  enabled: boolean;
};

export type ReportTemplate = ReportTemplateSummary & {
  sections: ReportSection[];
};

export type ReportGenerateRequest = {
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
  reportId: string;
  template: ReportTemplate;
  generatedAt: string;
  branding: ReportBranding;
  sections: Record<string, unknown>;
  metadata: {
    entityCount: number;
    dataFreshness: string;
    confidenceScore: number;
  };
  output: unknown;
};
