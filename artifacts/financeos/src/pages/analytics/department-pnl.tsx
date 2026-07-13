import { Fragment, useMemo, useState } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import {
  COST_CENTERS,
  departmentPnlLines,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { PnlLine } from "@/lib/analyticsTypes";

const SECTIONS: PnlLine["section"][] = ["Revenue", "Cost of Revenue", "Operating Expenses"];

export default function DepartmentPnlPage() {
  const { entity } = useAnalyticsFilters();
  const [costCenterId, setCostCenterId] = useState<string>(COST_CENTERS[0]?.id ?? "");
  const [fullyLoaded, setFullyLoaded] = useState(true);

  const lines = useMemo(
    () => departmentPnlLines(costCenterId, entity),
    [costCenterId, entity],
  );

  const displayedAdj = (l: PnlLine) => (fullyLoaded ? l.allocationAdjustment : 0);
  const adjustedOf = (l: PnlLine) => l.bookAmount + displayedAdj(l);

  const sectionTotals = (section: PnlLine["section"]) => {
    const rows = lines.filter((l) => l.section === section);
    return {
      book: rows.reduce((s, l) => s + l.bookAmount, 0),
      adj: rows.reduce((s, l) => s + displayedAdj(l), 0),
      adjusted: rows.reduce((s, l) => s + adjustedOf(l), 0),
      budget: rows.reduce((s, l) => s + l.budget, 0),
      priorPeriod: rows.reduce((s, l) => s + l.priorPeriod, 0),
      priorYear: rows.reduce((s, l) => s + l.priorYear, 0),
    };
  };

  const revenue = sectionTotals("Revenue");
  const cogs = sectionTotals("Cost of Revenue");
  const opex = sectionTotals("Operating Expenses");

  const netIncome = {
    book: revenue.book - cogs.book - opex.book,
    adj: revenue.adj - cogs.adj - opex.adj,
    adjusted: revenue.adjusted - cogs.adjusted - opex.adjusted,
    budget: revenue.budget - cogs.budget - opex.budget,
    priorPeriod: revenue.priorPeriod - cogs.priorPeriod - opex.priorPeriod,
    priorYear: revenue.priorYear - cogs.priorYear - opex.priorYear,
  };

  const num = (n: number, muted = false) => (
    <span className={muted ? "text-gray-400" : "text-gray-700"}>{fmtMoneyFull(n)}</span>
  );

  const variance = (amount: number, budget: number) => {
    const v = amount - budget;
    return (
      <span className={v >= 0 ? "text-emerald-600" : "text-red-500"}>{fmtMoneyFull(v)}</span>
    );
  };

  return (
    <AnalyticsLayout
      title="Department P&L"
      subtitle="Management P&L by department and cost center."
    >
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">Management P&amp;L</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger className="w-[220px] h-8 text-xs" data-testid="select-cost-center">
                <SelectValue placeholder="Cost center" />
              </SelectTrigger>
              <SelectContent>
                {COST_CENTERS.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.code} · {cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border border-gray-200 overflow-hidden" data-testid="toggle-basis">
              <button
                onClick={() => setFullyLoaded(false)}
                className={`text-xs font-medium px-2.5 py-1.5 transition-colors ${!fullyLoaded ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"}`}
                data-testid="toggle-book-only"
              >
                Book only
              </button>
              <button
                onClick={() => setFullyLoaded(true)}
                className={`text-xs font-medium px-2.5 py-1.5 transition-colors ${fullyLoaded ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"}`}
                data-testid="toggle-fully-loaded"
              >
                Fully loaded
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-department-pnl">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Line</th>
                <th className="text-right px-4 py-2.5">Book Amount</th>
                <th className="text-right px-4 py-2.5">Allocation Adj.</th>
                <th className="text-right px-4 py-2.5">Fully Loaded</th>
                <th className="text-right px-4 py-2.5">Budget</th>
                <th className="text-right px-4 py-2.5">Variance</th>
                <th className="text-right px-4 py-2.5">Prior Period</th>
                <th className="text-right px-4 py-2.5">Prior Year</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => {
                const rows = lines.filter((l) => l.section === section);
                const totals = sectionTotals(section);
                return (
                  <Fragment key={section}>
                    <tr className="bg-gray-50/60">
                      <td colSpan={8} className="px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{section}</td>
                    </tr>
                    {rows.map((l) => {
                      const adjusted = adjustedOf(l);
                      return (
                        <tr key={l.label} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-700 pl-6">{l.label}</td>
                          <td className="px-4 py-3 text-right">{num(l.bookAmount)}</td>
                          <td className="px-4 py-3 text-right">{num(displayedAdj(l), displayedAdj(l) === 0)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoneyFull(adjusted)}</td>
                          <td className="px-4 py-3 text-right">{num(l.budget, true)}</td>
                          <td className="px-4 py-3 text-right font-medium">{variance(adjusted, l.budget)}</td>
                          <td className="px-4 py-3 text-right">{num(l.priorPeriod, true)}</td>
                          <td className="px-4 py-3 text-right">{num(l.priorYear, true)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-800">
                      <td className="px-4 py-2.5">Total {section}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.book)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.adj)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.adjusted)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.budget)}</td>
                      <td className="px-4 py-2.5 text-right">{variance(totals.adjusted, totals.budget)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.priorPeriod)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoneyFull(totals.priorYear)}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="bg-indigo-50/60 font-bold text-gray-900 border-t-2 border-indigo-100">
                <td className="px-4 py-3">Net Income</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.book)}</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.adj)}</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.adjusted)}</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.budget)}</td>
                <td className="px-4 py-3 text-right">{variance(netIncome.adjusted, netIncome.budget)}</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.priorPeriod)}</td>
                <td className="px-4 py-3 text-right">{fmtMoneyFull(netIncome.priorYear)}</td>
              </tr>
              <tr className="text-[11px] text-gray-500">
                <td className="px-4 py-2">Net Margin</td>
                <td className="px-4 py-2 text-right">{fmtPct(revenue.book > 0 ? (netIncome.book / revenue.book) * 100 : null)}</td>
                <td className="px-4 py-2 text-right"></td>
                <td className="px-4 py-2 text-right">{fmtPct(revenue.adjusted > 0 ? (netIncome.adjusted / revenue.adjusted) * 100 : null)}</td>
                <td className="px-4 py-2 text-right" colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
