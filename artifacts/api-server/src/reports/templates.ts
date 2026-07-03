/**
 * Report Engine — template registry.
 *
 * A ReportTemplate is a declarative list of sections; the builder (builder.ts)
 * does the actual data assembly, and the renderer (renderer.ts) decides how
 * to serialize the result for a given output format. Templates never know
 * about output format beyond declaring which formats they support.
 */

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

export type ReportOutputFormat = "json" | "pdf" | "excel" | "html";

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  defaultEntities: "all" | "single";
  supportedFormats: ReportOutputFormat[];
  enabled: boolean;
};

function section(type: ReportSectionType, title: string, includeEntities = true): ReportSection {
  return { id: type, title, type, includeEntities };
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "monthly-close",
    name: "Monthly Close Report",
    description: "Standard month-end financial close summary across the portfolio.",
    sections: [
      section("executive_summary", "Executive Summary", false),
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("entity_summary", "Entity Summary"),
      section("financials", "Financials"),
      section("alerts", "Alerts"),
      section("validation", "Validation", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
  {
    id: "quarterly-close",
    name: "Quarterly Close Report",
    description: "Quarter-end financial close summary with recommendations and supporting appendix.",
    sections: [
      section("executive_summary", "Executive Summary", false),
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("entity_summary", "Entity Summary"),
      section("financials", "Financials"),
      section("alerts", "Alerts"),
      section("validation", "Validation", false),
      section("recommendations", "Recommendations", false),
      section("appendix", "Appendix", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
  {
    id: "board-package",
    name: "Board Package",
    description: "Executive-ready package for presenting portfolio performance to the board of directors.",
    sections: [
      section("executive_summary", "Executive Summary", false),
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("entity_summary", "Entity Summary"),
      section("financials", "Financials"),
      section("recommendations", "Recommendations", false),
      section("alerts", "Alerts"),
      section("appendix", "Appendix", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
  {
    id: "executive-package",
    name: "Executive Package",
    description: "Condensed high-level summary for executive leadership.",
    sections: [
      section("executive_summary", "Executive Summary", false),
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("alerts", "Alerts"),
      section("recommendations", "Recommendations", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
  {
    id: "investor-update",
    name: "Investor Update",
    description: "Portfolio performance update formatted for investor distribution.",
    sections: [
      section("executive_summary", "Executive Summary", false),
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("entity_summary", "Entity Summary"),
      section("financials", "Financials"),
      section("recommendations", "Recommendations", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
  {
    id: "bank-package",
    name: "Bank Package",
    description: "Financial package formatted for bank and lender review.",
    sections: [
      section("portfolio_kpis", "Portfolio KPIs", false),
      section("entity_summary", "Entity Summary"),
      section("financials", "Financials"),
      section("validation", "Validation", false),
      section("appendix", "Appendix", false),
    ],
    defaultEntities: "all",
    supportedFormats: ["json"],
    enabled: true,
  },
];
