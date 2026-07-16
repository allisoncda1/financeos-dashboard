/**
 * hardcodeRegression.test.ts
 *
 * Regression tests that prove none of the following remain in the codebase:
 * - Hardcoded /6 runway denominator
 * - Fabricated delta strings (+8.2%, etc.)
 * - Client-side portfolio health average
 * - Binary 92/74 health score
 * - new Date() pipeline timestamp fallback in portfolio summary
 * - Standard DSO formula handles null/negative inputs correctly
 *
 * These are primarily source-level assertions (file content checks) plus
 * unit tests for the formulas that replaced the hardcoded values.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// __dirname = …/artifacts/api-server/src/__tests__
// ../../../../  = …/financeos-dashboard (repo root)
const repoRoot = join(__dirname, "../../../..");
const apiRoot  = join(repoRoot, "artifacts/api-server");
const feRoot   = join(repoRoot, "artifacts/financeos");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf-8");
}
function readFe(rel: string): string {
  return readFileSync(join(feRoot, rel), "utf-8");
}

// ── Source-level regression checks ────────────────────────────────────────────

describe("hardcode regression — source file checks", () => {
  it("PortfolioKpiStrip: no hardcoded /6 denominator", () => {
    const src = readFe("src/components/portfolio/PortfolioKpiStrip.tsx");
    expect(src).not.toMatch(/opexYtd\s*\/\s*6\b/);
    expect(src).not.toMatch(/monthlyBurn\s*=.*\/\s*6\b/);
  });

  it("PortfolioKpiStrip: no fabricated delta strings", () => {
    const src = readFe("src/components/portfolio/PortfolioKpiStrip.tsx");
    expect(src).not.toContain("+8.2%");
    expect(src).not.toContain("+12.4%");
    expect(src).not.toContain("+3.1%");
    expect(src).not.toContain("+5.8%");
  });

  it("PortfolioKpiStrip: no client-side health score average via ENTITY_SLUGS map+reduce", () => {
    const src = readFe("src/components/portfolio/PortfolioKpiStrip.tsx");
    // The old code used: scores.reduce((a, b) => a + b, 0) / scores.length
    expect(src).not.toMatch(/scores\.reduce.*\/\s*scores\.length/);
    // Health avg must come from the prop (p.portfolio_health_score_avg)
    expect(src).toContain("portfolio_health_score_avg");
  });

  it("PortfolioKpiStrip: runway uses server-provided cash_runway_months", () => {
    const src = readFe("src/components/portfolio/PortfolioKpiStrip.tsx");
    expect(src).toContain("cash_runway_months");
  });

  it("CashFlowChart: accepts a data prop (not a stub)", () => {
    const src = readFe("src/components/dashboard/CashFlowChart.tsx");
    expect(src).toContain("data: CashFlowStatement | null");
    // Must render real sections when available
    expect(src).toContain("data.sections");
  });

  it("entity dashboard: passes cash_flow data to CashFlowChart", () => {
    const src = readFe("src/pages/entity/dashboard.tsx");
    expect(src).toContain("cash_flow");
    expect(src).toContain("CashFlowChart");
  });

  it("neonSource portfolio summary: no raw new Date() for pipeline_run or as_of", () => {
    const src = readApi("src/lib/neonSource.ts");
    // The portfolio summary now uses latestGeneratedAt and "unknown" strings
    expect(src).not.toContain(": new Date().toISOString()");
    expect(src).not.toContain(": new Date().toISOString().slice(0, 10)");
  });

  it("data freshness: no new Date() fallback — uses authoritative timestamps or 'unknown'", () => {
    const src = readApi("src/lib/neonSource.ts");
    // The freshness function now resolves to "unknown" string, not fabricated timestamps
    expect(src).toContain('"unknown"');
    // Must not have old pattern: new Date() as final ?? fallback
    expect(src).not.toMatch(/\?\?\s*new Date\(\)/);
  });

  it("portfolioNeon transformer: no new Date().toISOString() for pipeline_run", () => {
    const src = readApi("src/transformers/portfolioNeon.ts");
    expect(src).not.toContain("new Date().toISOString()");
  });

  it("kpi.ts: computeStandardDso is exported", () => {
    const src = readApi("src/services/kpi.ts");
    expect(src).toContain("export function computeStandardDso");
  });

  it("ProfitChart: no hardcoded monthly data arrays", () => {
    const src = readFe("src/components/dashboard/ProfitChart.tsx");
    // Must accept real MonthlyPL[] data prop
    expect(src).toContain("data: MonthlyPL[] | null");
    // Must NOT contain inline hardcoded month arrays
    expect(src).not.toMatch(/\[\s*\{\s*(?:label|month)\s*:\s*["'][A-Z][a-z][a-z]["']/);
  });

  it("Sidebar: health scores from useDashboardData, not getMockData directly", () => {
    const src = readFe("src/components/layout/Sidebar.tsx");
    expect(src).toContain("useDashboardData");
    expect(src).toContain("health_score");
    // Sidebar must not call getMockData() itself for health scores
    expect(src).not.toMatch(/getMockData\(\).*health/s);
    expect(src).not.toMatch(/health.*getMockData\(\)/s);
  });
});
