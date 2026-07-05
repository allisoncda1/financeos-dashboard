
import { useState } from "react";
import { useValidationMatrix } from "@/hooks/useApi";
import { ENTITY_CONFIG } from "@/lib/entities";
import type { ValidationCellStatus } from "@/lib/types";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Info } from "lucide-react";
import { formatPercent } from "@/lib/format";

// Rule metadata for display — labels/descriptions keyed by the Core rule ids
// published in validation_results.rule_results. Statuses always come from the
// API, never from here.
const RULE_META: Record<string, { label: string; description: string; failCondition: string; category: string }> = {
  balance_sheet_balances_current:  { label: "Balance sheet balances (current)",  category: "Balance Sheet", description: "For the current period, Assets must equal Liabilities + Equity.", failCondition: "Assets ≠ Liabilities + Equity beyond a small rounding tolerance." },
  balance_sheet_balances_eoy_2025: { label: "Balance sheet balances (EOY 2025)", category: "Balance Sheet", description: "At end of year 2025, Assets must equal Liabilities + Equity.",   failCondition: "Assets ≠ Liabilities + Equity beyond a small rounding tolerance." },
  pl_gross_profit_fy2025:          { label: "Gross profit present (FY2025)",      category: "P&L",           description: "The FY2025 P&L must report a gross profit figure.",                failCondition: "Gross profit is missing for FY2025." },
  pl_gross_profit_ytd_2026:        { label: "Gross profit present (YTD 2026)",    category: "P&L",           description: "The YTD 2026 P&L must report a gross profit figure.",              failCondition: "Gross profit is missing for YTD 2026." },
  ar_bs_vs_aging_match:            { label: "AR: balance sheet vs aging match",  category: "AR/AP",         description: "Accounts receivable on the balance sheet must match the AR aging total.", failCondition: "Balance-sheet AR and AR aging total differ beyond tolerance." },
  annual_period_exists:            { label: "Annual period exists",              category: "Periods",       description: "An annual reporting period must be present.",                      failCondition: "No annual period found." },
  ytd_period_exists:               { label: "YTD period exists",                 category: "Periods",       description: "A year-to-date reporting period must be present.",                 failCondition: "No YTD period found." },
  monthly_periods_present:         { label: "Monthly periods present",           category: "Periods",       description: "Monthly reporting periods must be present.",                       failCondition: "Monthly periods are missing." },
  quarterly_periods_present:       { label: "Quarterly periods present",         category: "Periods",       description: "Quarterly reporting periods must be present.",                     failCondition: "Quarterly periods are missing." },
  annual_revenue_positive:         { label: "Annual revenue positive",           category: "P&L",           description: "Annual revenue must be positive.",                                failCondition: "Annual revenue is zero or negative." },
  dso_plausible:                   { label: "DSO plausible",                     category: "AR/AP",         description: "Days Sales Outstanding must fall within a plausible range.",       failCondition: "DSO is negative or implausibly large." },
  all_report_variants_present:     { label: "All report variants present",       category: "Reports",       description: "All expected report variants must be generated.",                  failCondition: "One or more expected report variants are missing." },
};

const categoryColors: Record<string, string> = {
  "P&L":           "#10B981",
  "AR/AP":         "#F59E0B",
  "Banking":       "#3B82F6",
  "Balance Sheet": "#6366F1",
  "Periods":       "#8B5CF6",
  "Reports":       "#EC4899",
};

function StatusIcon({ status, className = "w-4 h-4" }: { status: ValidationCellStatus; className?: string }) {
  if (status === "pass") return <CheckCircle2 className={`${className} text-emerald-500`} />;
  if (status === "fail") return <XCircle className={`${className} text-red-500`} />;
  return <HelpCircle className={`${className} text-gray-400`} />;
}

const cellBg: Record<ValidationCellStatus, string> = {
  pass: "bg-emerald-50 hover:bg-emerald-100",
  fail: "bg-red-50 hover:bg-red-100",
  unknown: "bg-gray-100 hover:bg-gray-200",
};

export default function ValidationPage() {
  const { data, source } = useValidationMatrix();
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ slug: string; rule: string } | null>(null);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Validation results unavailable"}
      </div>
    );
  }

  const { reported, matrix, rule_ids: ruleIds, entity_slugs: entitySlugs, discrepancies } = data;

  const passPct =
    reported.total_checks !== null && reported.total_checks > 0 && reported.passed !== null
      ? Math.round((Math.min(reported.passed, reported.total_checks) / reported.total_checks) * 100)
      : null;

  // Overall status for a rule row across entities.
  function ruleStatus(rule: string): ValidationCellStatus {
    const statuses = entitySlugs.map((s) => matrix[s]?.[rule] ?? "unknown");
    if (statuses.some((s) => s === "fail")) return "fail";
    if (statuses.some((s) => s === "unknown")) return "unknown";
    return "pass";
  }

  const unknownCells = entitySlugs.reduce(
    (sum, slug) => sum + ruleIds.filter((r) => (matrix[slug]?.[r] ?? "unknown") === "unknown").length,
    0,
  );

  const activeRule = selectedRule ?? selectedCell?.rule ?? null;
  const activeRuleMeta = activeRule ? RULE_META[activeRule] ?? null : null;

  const headerPill =
    reported.passed !== null && reported.total_checks !== null
      ? `Pipeline reported ${reported.passed} passed / ${reported.failed ?? "?"} failed (declared total ${reported.total_checks})`
      : reported.all_passed !== null
      ? (reported.all_passed ? "All checks passed" : "Issues found")
      : "Result unavailable";

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
            <p className="text-[11px] text-gray-400">
              {ruleIds.length} rules × {entitySlugs.length} entities{data.generated_at ? ` · ${data.generated_at}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${
            discrepancies.length > 0
              ? "text-amber-700 bg-amber-50"
              : (reported.failed ?? 0) > 0
              ? "text-red-700 bg-red-50"
              : "text-emerald-700 bg-emerald-50"
          }`}>
            {headerPill}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-0">

        {/* Left: matrix + run details */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">

          {/* Discrepancy banner — the pipeline's own numbers don't add up */}
          {discrepancies.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold text-amber-800 mb-1.5">
                    The pipeline's latest validation summary is internally inconsistent
                  </p>
                  <ul className="space-y-1">
                    {discrepancies.map((d, i) => (
                      <li key={i} className="text-[11px] text-amber-800 leading-relaxed flex gap-1.5">
                        <span className="flex-shrink-0">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Overview KPI row — reported by the pipeline, not recomputed */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Expected Checks",  value: data.expected_checks,          color: "text-gray-900",    sub: `${ruleIds.length} rules × ${entitySlugs.length} entities` },
              { label: "Reported Passed",  value: reported.passed ?? "—",         color: "text-emerald-600", sub: "as published by pipeline" },
              { label: "Reported Failed",  value: reported.failed ?? "—",         color: (reported.failed ?? 0) > 0 ? "text-red-600" : "text-gray-900", sub: "as published by pipeline" },
              { label: "Not Reported",     value: unknownCells,                   color: unknownCells > 0 ? "text-gray-500" : "text-gray-900", sub: "cells without a per-rule result" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{c.label}</p>
                <p className={`text-[28px] font-black mt-1 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Matrix */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">
                Validation Matrix — {entitySlugs.length} Entities × {ruleIds.length} Rules
              </h3>
              <p className="text-[11px] text-gray-400">{data.cell_basis}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-44">Rule</th>
                    {entitySlugs.map((slug) => {
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
                  {ruleIds.map((rule) => {
                    const meta = RULE_META[rule];
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
                            {meta && (
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: `${categoryColors[meta.category]}1A`, color: categoryColors[meta.category] }}
                                >
                                  {meta.category}
                                </span>
                              </div>
                            )}
                            <p className={`text-[12px] font-medium mt-0.5 group-hover:text-gray-900 ${isActiveRule ? "text-gray-900" : "text-gray-700"}`}>
                              {meta?.label ?? rule}
                            </p>
                          </button>
                        </td>
                        {entitySlugs.map((slug) => {
                          const status = matrix[slug]?.[rule] ?? "unknown";
                          const isActiveCell = selectedCell?.slug === slug && selectedCell?.rule === rule;
                          return (
                            <td key={slug} className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => setSelectedCell(isActiveCell ? null : { slug, rule })}
                                title={status === "unknown" ? "No per-rule result published by the pipeline" : status}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                  isActiveCell ? "ring-2 ring-offset-1 ring-gray-400" : ""
                                } ${cellBg[status]}`}
                              >
                                <StatusIcon status={status} />
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            overall === "pass" ? "bg-emerald-50 text-emerald-700" :
                            overall === "fail" ? "bg-red-50 text-red-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {overall === "pass" ? "PASS" : overall === "fail" ? "FAIL" : "NOT REPORTED"}
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
                    {entitySlugs.map((slug) => {
                      const statuses = ruleIds.map((r) => matrix[slug]?.[r] ?? "unknown");
                      const hasUnknown = statuses.some((s) => s === "unknown");
                      if (hasUnknown) {
                        return (
                          <td key={slug} className="px-3 py-2.5 text-center">
                            <span className="text-[11px] font-bold text-gray-400" title="Per-rule results not published by the pipeline">—</span>
                          </td>
                        );
                      }
                      const passed = statuses.filter((s) => s === "pass").length;
                      const pct = Math.round((passed / statuses.length) * 100);
                      return (
                        <td key={slug} className="px-3 py-2.5 text-center">
                          <span className={`text-[11px] font-bold ${pct === 100 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600"}`}>
                            {formatPercent(pct, { decimals: 0 })}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center text-[11px] font-black text-gray-600">
                      {unknownCells === 0 && passPct !== null ? formatPercent(passPct, { decimals: 0 }) : "—"}
                    </td>
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
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{data.generated_at ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Reported Result</p>
                <p className={`text-[13px] font-bold mt-0.5 ${
                  reported.all_passed ? "text-emerald-600" : (reported.failed ?? 0) > 0 ? "text-red-600" : "text-amber-600"
                }`}>
                  {reported.passed !== null && reported.total_checks !== null
                    ? `${reported.passed} passed / ${reported.failed ?? "?"} failed of ${reported.total_checks} declared`
                    : reported.status_label}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Detail Level</p>
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">
                  {data.granularity === "per_rule" ? "Per-rule outcomes" : "Summary counts only"}
                </p>
              </div>
            </div>
            {reported.note && (
              <p className="text-[11px] text-gray-500 mt-3">Pipeline note: {reported.note}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5">
              Run history isn't available yet — only the most recent pipeline validation run is stored.
            </p>
          </div>
        </div>

        {/* Right: rule detail panel */}
        <aside className={`flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto transition-all duration-200 ${activeRule ? "w-[300px]" : "w-0 border-l-0"}`}>
          {activeRule && (
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
                  {activeRuleMeta && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${categoryColors[activeRuleMeta.category]}1A`, color: categoryColors[activeRuleMeta.category] }}
                    >
                      {activeRuleMeta.category}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">{activeRule}</span>
                </div>
                <p className="text-[14px] font-bold text-gray-900">{activeRuleMeta?.label ?? activeRule}</p>
              </div>

              {/* Description */}
              {activeRuleMeta && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">What it checks</p>
                  <p className="text-[12px] text-gray-700 leading-relaxed">{activeRuleMeta.description}</p>
                </div>
              )}

              {/* Fail condition */}
              {activeRuleMeta && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[9px] font-semibold text-red-400 uppercase tracking-widest mb-1.5">Fails when</p>
                  <p className="text-[12px] text-red-700 leading-relaxed">{activeRuleMeta.failCondition}</p>
                </div>
              )}

              {/* Per-entity status — straight from the pipeline endpoint */}
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Entity Results</p>
                <div className="space-y-2">
                  {entitySlugs.map((slug) => {
                    const cfg = ENTITY_CONFIG[slug];
                    const status = matrix[slug]?.[activeRule] ?? "unknown";
                    return (
                      <div key={slug} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                        status === "pass" ? "bg-emerald-50" : status === "fail" ? "bg-red-50" : "bg-gray-100"
                      }`}>
                        <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: cfg.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-semibold text-gray-800">{cfg.name}</span>
                            <StatusIcon status={status} className="w-3.5 h-3.5" />
                          </div>
                          {status === "unknown" && (
                            <p className="text-[10px] text-gray-500 leading-snug">No per-rule result published for this run.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data source explanation */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9px] font-semibold text-blue-600 uppercase tracking-widest mb-1">Where these results come from</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      {data.granularity === "per_rule"
                        ? "Statuses come directly from FinanceOS Core's per-entity, per-rule validation results. When Core doesn't report an outcome for a rule, the cell is shown as \"not reported\" rather than guessed."
                        : "Statuses come directly from the data pipeline's published validation output. The pipeline currently publishes pass/fail counts only — when it doesn't report a per-rule outcome, the cell is shown as \"not reported\" rather than guessed."}
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
