
import { useState } from "react";
import { useDashboardData } from "@/hooks/useApi";
import { ENTITY_SLUGS, ENTITY_CONFIG } from "@/lib/entities";
import type { DashboardData } from "@/lib/types";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

// 10 rules × description + what triggers a failure
const RULES: Record<string, { label: string; description: string; failCondition: string; category: string }> = {
  "1":  { label: "Revenue ≥ 0",          category: "P&L",      description: "Total revenue for the period must be non-negative.",                    failCondition: "Revenue field is null, negative, or missing." },
  "2":  { label: "COGS ≤ Revenue",        category: "P&L",      description: "Cost of goods sold must not exceed total revenue.",                     failCondition: "COGS > Revenue in any period." },
  "2b": { label: "Gross Margin > 0%",     category: "P&L",      description: "Gross profit margin must be positive.",                                 failCondition: "Gross profit is zero or negative." },
  "3":  { label: "Net Income checks",     category: "P&L",      description: "Net Income = Gross Profit − OpEx. Must balance to within $1.",          failCondition: "Net Income deviates from Gross Profit − OpEx by more than $1." },
  "4":  { label: "AR aging sums",         category: "AR/AP",    description: "All AR aging bucket amounts must sum to total Open AR.",                 failCondition: "AR aging buckets do not sum to open_ar within $1." },
  "5":  { label: "AP aging sums",         category: "AR/AP",    description: "All AP aging bucket amounts must sum to total Open AP.",                 failCondition: "AP aging buckets do not sum to open_ap within $1." },
  "6":  { label: "Cash balance positive", category: "Banking",  description: "Cash on hand must be positive across all bank accounts.",               failCondition: "Any bank account balance is negative or total cash is zero." },
  "7":  { label: "AP overdue threshold",  category: "AR/AP",    description: "AP overdue % must remain below 5% of total AP.",                        failCondition: "ap_overdue_pct > 5%." },
  "8a": { label: "DSO within policy",     category: "AR/AP",    description: "Days Sales Outstanding must remain at or below 60 days.",               failCondition: "dso_days > 60." },
  "8b": { label: "AR MoM variance",       category: "AR/AP",    description: "AR balance must not increase more than 20% month-over-month without a proportional revenue increase.", failCondition: "AR MoM growth > 20% with no corresponding revenue increase." },
};

// Per-entity, per-rule result — derived from anomalies + metrics
function buildMatrix(data: DashboardData): Record<string, Record<string, "pass" | "warn" | "fail">> {
  const result: Record<string, Record<string, "pass" | "warn" | "fail">> = {};
  ENTITY_SLUGS.forEach((slug) => {
    result[slug] = {};
    Object.keys(RULES).forEach((r) => { result[slug][r] = "pass"; });
    // Apply anomalies as warn/fail
    data.anomalies[slug].forEach((a) => {
      result[slug][a.rule] = a.severity === "error" ? "fail" : "warn";
    });
    // Rule 7: ap_overdue_pct > 5 → warn
    if (data.metrics[slug].ap_overdue_pct > 5) result[slug]["7"] = "warn";
    // Rule 8a: dso_days > 60 → warn
    if (data.metrics[slug].dso_days > 60) result[slug]["8a"] = "warn";
  });
  return result;
}

export default function ValidationPage() {
  const { data, source } = useDashboardData();
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ slug: string; rule: string } | null>(null);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const matrix = buildMatrix(data);

  // The validation summary has two observed shapes: the declared
  // ValidationSummary type (mock/typed: run_date, passed, failed, rule_count,
  // entity_count) and the real Drive-backed pipeline output (generated_at,
  // pass_count, fail_count). Read both defensively — mirrors the api-server's
  // normalizeValidationSummary — so live data never renders "undefined"/NaN.
  const raw = data.validation as unknown as Record<string, unknown>;
  const num = (key: string): number | undefined => (typeof raw[key] === "number" ? (raw[key] as number) : undefined);
  const str = (key: string): string | undefined => (typeof raw[key] === "string" && raw[key] !== "" ? (raw[key] as string) : undefined);
  const v = {
    total_checks: num("total_checks"),
    passed: num("passed") ?? num("pass_count"),
    failed: num("failed") ?? num("fail_count"),
    all_passed: typeof raw["all_passed"] === "boolean" ? (raw["all_passed"] as boolean) : undefined,
    run_date: str("run_date") ?? str("generated_at"),
    as_of: str("as_of") ?? str("generated_at"),
    rule_count: num("rule_count") ?? Object.keys(RULES).length,
    entity_count: num("entity_count") ?? ENTITY_SLUGS.length,
  };
  const passPct =
    v.total_checks !== undefined && v.total_checks > 0 && v.passed !== undefined
      ? Math.round((v.passed / v.total_checks) * 100)
      : null;

  const ruleKeys = Object.keys(RULES);
  const categoryColors: Record<string, string> = {
    "P&L":     "#10B981",
    "AR/AP":   "#F59E0B",
    "Banking": "#3B82F6",
  };

  // Counts per rule across entities
  function ruleStatus(rule: string): "pass" | "warn" | "fail" {
    const statuses = ENTITY_SLUGS.map((s) => matrix[s][rule]);
    if (statuses.some((s) => s === "fail"))  return "fail";
    if (statuses.some((s) => s === "warn"))  return "warn";
    return "pass";
  }

  const activeRule = selectedRule ?? selectedCell?.rule ?? null;
  const activeRuleInfo = activeRule ? RULES[activeRule] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Validation Rules</h1>
            <p className="text-[11px] text-gray-400">{v.rule_count} rules × {v.entity_count} entities{v.run_date ? ` · ${v.run_date}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
            {v.passed !== undefined && v.total_checks !== undefined
              ? `${v.passed}/${v.total_checks} passed${passPct !== null ? ` (${passPct}%)` : ""}`
              : v.all_passed !== undefined
              ? (v.all_passed ? "All checks passed" : "Issues found")
              : "Result unavailable"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-0">

        {/* Left: matrix + history */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">

          {/* Overview KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Checks",  value: v.total_checks ?? "—", color: "text-gray-900" },
              { label: "Passed",        value: v.passed ?? "—",        color: "text-emerald-600" },
              { label: "Warnings",      value: ENTITY_SLUGS.reduce((s, slug) => s + Object.values(matrix[slug]).filter((v) => v === "warn").length, 0), color: "text-amber-600" },
              { label: "Failed",        value: v.failed ?? "—",        color: "text-red-600" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{c.label}</p>
                <p className={`text-[28px] font-black mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* 4×10 matrix */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Validation Matrix — 4 Entities × 10 Rules</h3>
              <p className="text-[11px] text-gray-400">Click any cell or rule name for details</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-44">Rule</th>
                    {ENTITY_SLUGS.map((slug) => {
                      const cfg = ENTITY_CONFIG[slug];
                      return (
                        <th key={slug} className="px-3 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                            <span className="text-[10px] font-semibold text-gray-600">{cfg.name}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleKeys.map((rule) => {
                    const r = RULES[rule];
                    const overall = ruleStatus(rule);
                    const isActiveRule = activeRule === rule;
                    return (
                      <tr
                        key={rule}
                        className={`border-t border-gray-50 transition-colors ${isActiveRule ? "bg-gray-50" : "hover:bg-gray-50/60"}`}
                      >
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setSelectedRule(selectedRule === rule ? null : rule)}
                            className="text-left group"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: `${categoryColors[r.category]}1A`, color: categoryColors[r.category] }}
                              >
                                {r.category}
                              </span>
                            </div>
                            <p className={`text-[12px] font-medium mt-0.5 group-hover:text-gray-900 ${isActiveRule ? "text-gray-900" : "text-gray-700"}`}>
                              {rule}. {r.label}
                            </p>
                          </button>
                        </td>
                        {ENTITY_SLUGS.map((slug) => {
                          const status = matrix[slug][rule];
                          const isActiveCell = selectedCell?.slug === slug && selectedCell?.rule === rule;
                          return (
                            <td key={slug} className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => setSelectedCell(isActiveCell ? null : { slug, rule })}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                  isActiveCell ? "ring-2 ring-offset-1 ring-gray-400" : ""
                                } ${
                                  status === "pass" ? "bg-emerald-50 hover:bg-emerald-100" :
                                  status === "warn" ? "bg-amber-50 hover:bg-amber-100" :
                                  "bg-red-50 hover:bg-red-100"
                                }`}
                              >
                                {status === "pass"
                                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  : status === "warn"
                                  ? <AlertCircle className="w-4 h-4 text-amber-500" />
                                  : <XCircle className="w-4 h-4 text-red-500" />
                                }
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            overall === "pass" ? "bg-emerald-50 text-emerald-700" :
                            overall === "warn" ? "bg-amber-50 text-amber-700" :
                            "bg-red-50 text-red-700"
                          }`}>
                            {overall === "pass" ? "PASS" : overall === "warn" ? "WARN" : "FAIL"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Entity totals row */}
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-4 py-2.5 text-[11px] font-bold text-gray-600">Pass Rate</td>
                    {ENTITY_SLUGS.map((slug) => {
                      const total = ruleKeys.length;
                      const passed = ruleKeys.filter((r) => matrix[slug][r] === "pass").length;
                      const pct = Math.round((passed / total) * 100);
                      return (
                        <td key={slug} className="px-3 py-2.5 text-center">
                          <span className={`text-[11px] font-bold ${pct === 100 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"}`}>
                            {pct}%
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center text-[11px] font-black text-emerald-600">{passPct !== null ? `${passPct}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Latest validation run */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-3">Latest Validation Run</h3>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Run Date</p>
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{v.run_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Data As Of</p>
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{v.as_of ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Result</p>
                <p className={`text-[13px] font-bold mt-0.5 ${v.all_passed ? "text-emerald-600" : (v.failed ?? 0) > 0 ? "text-red-600" : "text-amber-600"}`}>
                  {v.passed !== undefined && v.total_checks !== undefined
                    ? `${v.passed}/${v.total_checks} passed`
                    : v.all_passed !== undefined
                    ? (v.all_passed ? "All passed" : "Issues found")
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Run history isn't available yet — only the most recent pipeline validation run is stored.
            </p>
          </div>
        </div>

        {/* Right: rule detail panel */}
        <aside className={`flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto transition-all duration-200 ${activeRuleInfo ? "w-[300px]" : "w-0 border-l-0"}`}>
          {activeRuleInfo && activeRule && (
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500">Rule Detail</span>
                <button
                  onClick={() => { setSelectedRule(null); setSelectedCell(null); }}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >✕</button>
              </div>

              {/* Rule header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${categoryColors[activeRuleInfo.category]}1A`, color: categoryColors[activeRuleInfo.category] }}
                  >
                    {activeRuleInfo.category}
                  </span>
                  <span className="text-[10px] text-gray-400">Rule {activeRule}</span>
                </div>
                <p className="text-[14px] font-bold text-gray-900">{activeRuleInfo.label}</p>
              </div>

              {/* Description */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What it checks</p>
                <p className="text-[12px] text-gray-700 leading-relaxed">{activeRuleInfo.description}</p>
              </div>

              {/* Fail condition */}
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-[9px] font-semibold text-red-400 uppercase tracking-widest mb-1.5">Fails when</p>
                <p className="text-[12px] text-red-700 leading-relaxed">{activeRuleInfo.failCondition}</p>
              </div>

              {/* Per-entity status */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Entity Results</p>
                <div className="space-y-2">
                  {ENTITY_SLUGS.map((slug) => {
                    const cfg = ENTITY_CONFIG[slug];
                    const status = matrix[slug][activeRule];
                    const anomaly = data.anomalies[slug].find((a) => a.rule === activeRule);
                    return (
                      <div key={slug} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                        status === "pass" ? "bg-emerald-50" : status === "warn" ? "bg-amber-50" : "bg-red-50"
                      }`}>
                        <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: cfg.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-semibold text-gray-800">{cfg.name}</span>
                            {status === "pass"
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              : status === "warn"
                              ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500" />
                            }
                          </div>
                          {anomaly && (
                            <p className="text-[10px] text-gray-600 leading-snug">{anomaly.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confidence explanation */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest mb-1">Confidence Impact</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      Each failed rule reduces the portfolio confidence score. Warnings reduce it by 1–2 points;
                      failures reduce it by 5–10 points depending on the rule category.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
