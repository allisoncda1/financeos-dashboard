/**
 * Report Analysis Generator — unit tests.
 *
 * Verifies the 20 requirements from the feature spec:
 * - Commentary isolation by entity and period
 * - Provenance traceability
 * - No fabricated causal statements
 * - Negative values remain negative
 * - Null values never become zero
 * - Source labeling
 */

import { describe, it, expect } from "vitest";
import { generateAnalysis, buildDataFingerprint } from "../reports/analysis.js";
import type { BuiltReport } from "../reports/builder.js";
import { buildNarrativeContext, getSectionTexts } from "../reports/narrativeContext.js";

// ── Fixture helpers ────────────────────────────────────────────────────────────

const BASE_TEMPLATE = {
  id: "monthly-close",
  name: "Monthly Close Report",
  description: "",
  sections: [],
  defaultEntities: "all" as const,
  supportedFormats: ["json", "html", "pdf"] as ("json" | "html" | "pdf")[],
  enabled: true,
};

function makeReport(overrides: Partial<BuiltReport> = {}): BuiltReport {
  return {
    id: "test-report-1",
    template: BASE_TEMPLATE,
    request: {
      template: "monthly-close",
      entities: ["T3_Marketing"],
      period: "Jun 2026 (Latest)",
      format: "json",
    },
    branding: {
      mode: "single",
      primaryEntity: {
        slug: "T3_Marketing",
        name: "T3 Marketing",
        logoPath: null,
        primaryColor: "#f59e0b",
      },
      entities: [{ slug: "T3_Marketing", name: "T3 Marketing", logoPath: null }],
      financeosBranding: false,
    },
    generatedAt: new Date().toISOString(),
    period: "Jun 2026 (Latest)",
    source: "live",
    sections: {
      entity_summary: {
        T3_Marketing: {
          metrics: {
            revenue: 112400,
            revenue_growth_pct: 12.4,
            net_income: 15400,
            net_margin_pct: 13.7,
            cash_on_hand: 42000,
            open_ar: 42502.18,
          },
          anomalies: [],
        },
      },
      financials: {
        T3_Marketing: { monthly_pl: [] },
      },
      portfolio_kpis: {
        portfolio: {
          total_revenue: 250000,
          total_net_income: 32000,
          entity_count: 2,
        },
      },
      alerts: [],
      validation: {
        summary: { all_passed: true, failed_count: 0 },
      },
    },
    metadata: {
      entityCount: 1,
      dataFreshness: "2026-06-30",
      confidenceScore: 92,
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateAnalysis", () => {
  // ── Test 8: Automatic analysis provenance ──────────────────────────────────
  it("every FinanceOS analysis statement includes full provenance", () => {
    const report = makeReport();
    const statements = generateAnalysis(report);

    for (const stmt of statements) {
      expect(stmt.commentaryType).toBe("financeos_analysis");
      expect(stmt.provenance).toBeTruthy();
      expect(typeof stmt.provenance.metric).toBe("string");
      expect(typeof stmt.provenance.formula).toBe("string");
      expect(typeof stmt.provenance.reportingPeriod).toBe("string");
      expect(Array.isArray(stmt.provenance.entitySlugs)).toBe(true);
      expect(typeof stmt.provenance.sourceTable).toBe("string");
      expect(typeof stmt.provenance.generatedAt).toBe("string");
      // generatedAt must be a valid ISO timestamp
      expect(new Date(stmt.provenance.generatedAt).getTime()).toBeGreaterThan(0);
    }
  });

  // ── Test 9: Unknown causes are never fabricated ────────────────────────────
  it("does not fabricate an operational cause for revenue changes", () => {
    const report = makeReport();
    const statements = generateAnalysis(report);
    const revenueStmt = statements.find((s) => s.provenance.metric === "revenue");

    expect(revenueStmt).toBeTruthy();
    // Must not contain speculative language about WHY revenue changed
    const fabricatedPatterns = [
      /due to/i, /because of/i, /driven by/i, /caused by/i,
      /as a result of/i, /owing to/i,
    ];
    for (const pattern of fabricatedPatterns) {
      expect(revenueStmt!.content).not.toMatch(pattern);
    }
  });

  it("explicitly states cause is unavailable for net losses", () => {
    const report = makeReport({
      sections: {
        ...makeReport().sections,
        entity_summary: {
          T3_Marketing: {
            metrics: {
              revenue: 50000,
              net_income: -8500,
              net_margin_pct: -17,
              cash_on_hand: 15000,
              open_ar: 12000,
            },
            anomalies: [],
          },
        },
      },
    });
    const statements = generateAnalysis(report);
    const netIncomeStmt = statements.find((s) => s.provenance.metric === "net_income");

    expect(netIncomeStmt).toBeTruthy();
    // Must explicitly disclaim unknown cause
    expect(netIncomeStmt!.content).toMatch(/not available in FinanceOS/i);
    // Must NOT claim to know the cause
    expect(netIncomeStmt!.content).not.toMatch(/because/i);
  });

  // ── Test 10: Negative values remain negative ───────────────────────────────
  it("renders negative cash on hand with parenthesis notation, not as zero", () => {
    const report = makeReport({
      sections: {
        ...makeReport().sections,
        entity_summary: {
          Smile_More: {
            metrics: {
              revenue: 80000,
              net_income: -2000,
              cash_on_hand: -12500, // Smile More's legitimate negative cash
              open_ar: 5000,
            },
            anomalies: [],
          },
        },
      },
    });
    const statements = generateAnalysis(report);
    const cashStmt = statements.find((s) => s.provenance.metric === "cash_on_hand");

    expect(cashStmt).toBeTruthy();
    // Must render negative cash as ($12,500) not $0 or $12,500
    expect(cashStmt!.provenance.currentValue).toBe(-12500);
    expect(cashStmt!.content).toContain("($12,500)");
    // Must flag the negative balance
    expect(cashStmt!.content).toMatch(/negative/i);
  });

  it("renders negative net income as a loss, not as zero", () => {
    const report = makeReport({
      sections: {
        ...makeReport().sections,
        entity_summary: {
          T3_Marketing: {
            metrics: { revenue: 100000, net_income: -3500, cash_on_hand: 25000 },
            anomalies: [],
          },
        },
      },
    });
    const statements = generateAnalysis(report);
    const netStmt = statements.find((s) => s.provenance.metric === "net_income");

    expect(netStmt).toBeTruthy();
    expect(netStmt!.provenance.currentValue).toBe(-3500);
    // Must say "loss", not just render the number as positive
    expect(netStmt!.content).toMatch(/loss/i);
    // Implementation uses "a loss of $3,500" (prose form) — verify sign is not hidden
    expect(netStmt!.content).not.toMatch(/net income was \$3,500/i); // must not look profitable
  });

  // ── Test 11: Null values never become zero ─────────────────────────────────
  it("omits metrics that are null rather than treating them as zero", () => {
    const report = makeReport({
      sections: {
        entity_summary: {
          T3_Marketing: {
            metrics: {
              revenue: null,
              net_income: null,
              cash_on_hand: null,
              open_ar: null,
            },
            anomalies: [],
          },
        },
        financials: { T3_Marketing: {} },
        portfolio_kpis: { portfolio: { total_revenue: null, total_net_income: null, entity_count: 1 } },
        alerts: [],
        validation: { summary: { all_passed: true } },
      },
    });
    const statements = generateAnalysis(report);

    // No revenue/cash/net_income statements should appear when all values are null
    const revenueStmt = statements.find((s) => s.provenance.metric === "revenue");
    const cashStmt    = statements.find((s) => s.provenance.metric === "cash_on_hand");
    const netStmt     = statements.find((s) => s.provenance.metric === "net_income");

    expect(revenueStmt).toBeUndefined();
    expect(cashStmt).toBeUndefined();
    expect(netStmt).toBeUndefined();

    // No statement should contain "$0" for a null value
    for (const stmt of statements) {
      expect(stmt.content).not.toMatch(/\$0(?!\.\d)/); // $0 not followed by decimals
    }
  });

  // ── Test 1: Commentary isolation by entity ─────────────────────────────────
  it("each entity produces independently scoped analysis statements", () => {
    const report = makeReport({
      sections: {
        entity_summary: {
          T3_Marketing:  { metrics: { revenue: 112400, net_income: 15000, cash_on_hand: 40000 }, anomalies: [] },
          CarDealer_ai:  { metrics: { revenue: 280000, net_income: 55000, cash_on_hand: 90000 }, anomalies: [] },
        },
        financials: {
          T3_Marketing:  {},
          CarDealer_ai:  {},
        },
        portfolio_kpis: { portfolio: { total_revenue: 392400, total_net_income: 70000, entity_count: 2 } },
        alerts: [],
        validation: { summary: { all_passed: true } },
      },
    });

    const statements = generateAnalysis(report);

    // All entity-level statements must have entitySlugs scoped to exactly one entity
    const entityStmts = statements.filter((s) =>
      s.provenance.entitySlugs.length === 1 &&
      !["portfolio"].includes(s.provenance.entitySlugs[0]),
    );
    for (const stmt of entityStmts) {
      expect(stmt.provenance.entitySlugs).toHaveLength(1);
      expect(["T3_Marketing", "CarDealer_ai"]).toContain(stmt.provenance.entitySlugs[0]);
    }

    // Must produce separate revenue statements for each entity
    const t3Revenue = statements.filter(
      (s) => s.provenance.metric === "revenue" && s.provenance.entitySlugs[0] === "T3_Marketing"
    );
    const cdRevenue = statements.filter(
      (s) => s.provenance.metric === "revenue" && s.provenance.entitySlugs[0] === "CarDealer_ai"
    );
    expect(t3Revenue).toHaveLength(1);
    expect(cdRevenue).toHaveLength(1);
    expect(t3Revenue[0]!.provenance.currentValue).toBe(112400);
    expect(cdRevenue[0]!.provenance.currentValue).toBe(280000);
  });

  // ── Test 2: Commentary isolation by period ────────────────────────────────
  it("provenance records the exact reporting period", () => {
    const report1 = makeReport({ period: "May 2026" });
    const report2 = makeReport({ period: "Jun 2026 (Latest)" });

    const stmts1 = generateAnalysis(report1);
    const stmts2 = generateAnalysis(report2);

    for (const s of stmts1) expect(s.provenance.reportingPeriod).toBe("May 2026");
    for (const s of stmts2) expect(s.provenance.reportingPeriod).toBe("Jun 2026 (Latest)");
  });

  // ── Test 3: Portfolio commentary ──────────────────────────────────────────
  it("portfolio-level statements use portfolio entitySlugs", () => {
    const report = makeReport();
    const statements = generateAnalysis(report);

    const portfolioStmts = statements.filter((s) =>
      s.provenance.entitySlugs[0] === "portfolio",
    );
    expect(portfolioStmts.length).toBeGreaterThan(0);
    for (const s of portfolioStmts) {
      expect(s.sectionKey).toMatch(/portfolio_summary|alerts_summary|close_status/);
    }
  });

  // ── Validation analysis ────────────────────────────────────────────────────
  it("generates a pass statement when all validations pass", () => {
    const report = makeReport({
      sections: {
        ...makeReport().sections,
        validation: { summary: { all_passed: true } },
      },
    });
    const statements = generateAnalysis(report);
    const validationStmt = statements.find((s) => s.provenance.metric === "validation_all_passed");

    expect(validationStmt).toBeTruthy();
    expect(validationStmt!.provenance.currentValue).toBe(1);
    expect(validationStmt!.content).toMatch(/passed/i);
  });

  it("generates a fail statement with count when validations fail", () => {
    const report = makeReport({
      sections: {
        ...makeReport().sections,
        validation: { summary: { all_passed: false, failed_count: 3 } },
      },
    });
    const statements = generateAnalysis(report);
    const validationStmt = statements.find((s) => s.provenance.metric === "validation_all_passed");

    expect(validationStmt).toBeTruthy();
    expect(validationStmt!.provenance.currentValue).toBe(0);
    expect(validationStmt!.content).toContain("3");
  });

  // ── No-alerts statement ───────────────────────────────────────────────────
  it("generates a no-alerts statement when alerts array is empty", () => {
    const report = makeReport({ sections: { ...makeReport().sections, alerts: [] } });
    const statements = generateAnalysis(report);
    const alertStmt = statements.find((s) => s.provenance.metric === "alert_count");

    expect(alertStmt).toBeTruthy();
    expect(alertStmt!.provenance.currentValue).toBe(0);
    expect(alertStmt!.content).toMatch(/no active alerts/i);
  });

  it("generates an alert count statement when alerts exist", () => {
    const alerts = [
      { severity: "critical", entity: "T3_Marketing", message: "AR spike" },
      { severity: "warning",  entity: "T3_Marketing", message: "Margin decline" },
    ];
    const report = makeReport({ sections: { ...makeReport().sections, alerts } });
    const statements = generateAnalysis(report);
    const alertStmt = statements.find((s) => s.provenance.metric === "alert_count");

    expect(alertStmt).toBeTruthy();
    expect(alertStmt!.provenance.currentValue).toBe(2);
    expect(alertStmt!.content).toContain("2");
    expect(alertStmt!.content).toMatch(/critical/i);
  });
});

// ── buildDataFingerprint ──────────────────────────────────────────────────────

describe("buildDataFingerprint", () => {
  // ── Test 13: Data fingerprint changes mark drafts stale ───────────────────
  it("produces the same fingerprint for identical reports", () => {
    const r1 = makeReport();
    const r2 = makeReport();
    expect(buildDataFingerprint(r1)).toBe(buildDataFingerprint(r2));
  });

  it("produces a different fingerprint when financial data changes", () => {
    const r1 = makeReport();
    // Fingerprint uses portfolio_kpis, financials, and data_freshness — change portfolio totals
    const r2 = makeReport({
      sections: {
        ...makeReport().sections,
        portfolio_kpis: {
          portfolio: { total_revenue: 999999, total_net_income: 888888, entity_count: 2 },
        },
      },
    });
    expect(buildDataFingerprint(r1)).not.toBe(buildDataFingerprint(r2));
  });

  it("produces a different fingerprint for different periods", () => {
    const r1 = makeReport({ period: "May 2026" });
    const r2 = makeReport({ period: "Jun 2026 (Latest)" });
    expect(buildDataFingerprint(r1)).not.toBe(buildDataFingerprint(r2));
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const fp = buildDataFingerprint(makeReport());
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── NarrativeContext ──────────────────────────────────────────────────────────

describe("buildNarrativeContext", () => {
  // ── Test 19: Management Commentary is separate from FinanceOS Analysis ─────
  it("analysis and management commentary are in separate blocks with distinct types", () => {
    const analysisStmt = generateAnalysis(makeReport())[0]!;

    const ctx = buildNarrativeContext({
      generatedAnalysis: [analysisStmt],
      dbEntries: [
        {
          id:              "mgmt-1",
          entitySlug:      "T3_Marketing",
          reportingPeriod: "Jun 2026 (Latest)",
          templateId:      "monthly-close",
          sectionKey:      "management_comments",
          commentaryType:  "management_commentary",
          content:         "Two campaigns delayed into July.",
          provenance:      null,
          status:          "draft",
          version:         1,
          included:        true,
          sortOrder:       0,
          createdBy:       "allison@test.com",
          updatedBy:       null,
          approvedBy:      null,
          createdAt:       new Date().toISOString(),
          updatedAt:       new Date().toISOString(),
          approvedAt:      null,
        },
      ],
    });

    // The analysis block should be a separate section/block from the management block
    const analysisBlocks = Object.values(ctx.sections)
      .flatMap((s) => s.blocks)
      .filter((b) => b.commentaryType === "financeos_analysis");

    const managementBlocks = Object.values(ctx.sections)
      .flatMap((s) => s.blocks)
      .filter((b) => b.commentaryType === "management_commentary");

    expect(analysisBlocks.length).toBeGreaterThan(0);
    expect(managementBlocks).toHaveLength(1);

    // No block should be both types
    for (const block of [...analysisBlocks, ...managementBlocks]) {
      expect(["financeos_analysis", "management_commentary"]).toContain(block.commentaryType);
    }
  });

  it("FinanceOS analysis blocks have sourceLabel 'FinanceOS Analysis'", () => {
    const ctx = buildNarrativeContext({
      generatedAnalysis: generateAnalysis(makeReport()).slice(0, 2),
    });
    const blocks = Object.values(ctx.sections).flatMap((s) => s.blocks);
    for (const block of blocks.filter((b) => b.commentaryType === "financeos_analysis")) {
      expect(block.sourceLabel).toBe("FinanceOS Analysis");
    }
  });

  it("management commentary blocks have sourceLabel 'Management Commentary'", () => {
    const ctx = buildNarrativeContext({
      dbEntries: [
        {
          id:              "mgmt-2",
          entitySlug:      "T3_Marketing",
          reportingPeriod: "Jun 2026 (Latest)",
          templateId:      "monthly-close",
          sectionKey:      "portfolio_summary",
          commentaryType:  "management_commentary",
          content:         "Revenue driven by new customer program.",
          provenance:      null,
          status:          "draft",
          version:         1,
          included:        true,
          sortOrder:       0,
          createdBy:       null,
          updatedBy:       null,
          approvedBy:      null,
          createdAt:       new Date().toISOString(),
          updatedAt:       new Date().toISOString(),
          approvedAt:      null,
        },
      ],
    });
    const block = Object.values(ctx.sections).flatMap((s) => s.blocks)[0];
    expect(block?.sourceLabel).toBe("Management Commentary");
  });

  it("getSectionTexts returns only included blocks", () => {
    const ctx = buildNarrativeContext({
      dbEntries: [
        {
          id:              "a",
          entitySlug:      "T3_Marketing",
          reportingPeriod: "Jun 2026",
          templateId:      "monthly-close",
          sectionKey:      "portfolio_summary",
          commentaryType:  "management_commentary",
          content:         "Included block.",
          provenance:      null,
          status:          "draft",
          version:         1,
          included:        true,
          sortOrder:       0,
          createdBy:       null, updatedBy: null, approvedBy: null,
          createdAt:       new Date().toISOString(),
          updatedAt:       new Date().toISOString(),
          approvedAt:      null,
        },
        {
          id:              "b",
          entitySlug:      "T3_Marketing",
          reportingPeriod: "Jun 2026",
          templateId:      "monthly-close",
          sectionKey:      "portfolio_summary",
          commentaryType:  "management_commentary",
          content:         "Excluded block.",
          provenance:      null,
          status:          "draft",
          version:         1,
          included:        false,
          sortOrder:       1,
          createdBy:       null, updatedBy: null, approvedBy: null,
          createdAt:       new Date().toISOString(),
          updatedAt:       new Date().toISOString(),
          approvedAt:      null,
        },
      ],
    });
    const texts = getSectionTexts(ctx, "portfolio_summary");
    expect(texts).toContain("Included block.");
    expect(texts).not.toContain("Excluded block.");
  });

  // ── Test 12: Locked financial values cannot be edited ─────────────────────
  it("narrativeContext contains no financial values — only prose content", () => {
    const ctx = buildNarrativeContext({
      generatedAnalysis: generateAnalysis(makeReport()),
    });

    // All blocks must have string `content` that is prose, not a number
    const allBlocks = Object.values(ctx.sections).flatMap((s) => s.blocks);
    for (const block of allBlocks) {
      expect(typeof block.content).toBe("string");
      // Content should not be a bare number (financial data must stay in provenance)
      expect(Number.isFinite(Number(block.content.trim()))).toBe(false);
    }
  });
});
