import { useState } from "react";
import { useEntityBudget, useBudgetMutation } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG } from "@/lib/entities";
import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Save, Info } from "lucide-react";
import type { BudgetPeriodInput } from "@/lib/types";

const MONTHS_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type CellKey = `${number}-${"revenue" | "cogs" | "opex" | "net_income"}`;
type EditMap = Map<CellKey, string>;

const LINE_ITEMS = [
  { key: "revenue", label: "Revenue" },
  { key: "cogs", label: "COGS" },
  { key: "opex", label: "Opex" },
  { key: "net_income", label: "Net Income" },
] as const;

export default function BudgetBuilderPage() {
  const { activeSlug } = useBudgetEntity();
  const { save, saving, error, refreshKey } = useBudgetMutation();
  const { data, source } = useEntityBudget(activeSlug, undefined, refreshKey);

  const [edits, setEdits] = useState<EditMap>(new Map());
  const [savedMonths, setSavedMonths] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const year = data?.year ?? new Date().getFullYear();
  const entityName = ENTITY_CONFIG[activeSlug]?.name ?? activeSlug;

  const getValue = (month: number, key: string): string => {
    const cellKey = `${month}-${key}` as CellKey;
    if (edits.has(cellKey)) return edits.get(cellKey)!;
    const monthStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const row = data?.months.find((m) => m.period_start === monthStr);
    if (!row) return "";
    const val = row[`${key}_target` as keyof typeof row] as number | null;
    return val !== null ? String(val) : "";
  };

  const handleChange = (month: number, key: string, value: string) => {
    const cellKey = `${month}-${key}` as CellKey;
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(cellKey, value);
      return next;
    });
  };

  const handleSaveMonth = async (month: number) => {
    setSaveError(null);
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = lastDayOfMonth(year, month);

    const toNum = (key: string): number | null => {
      const v = getValue(month, key);
      if (v === "" || v === null) return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const payload: BudgetPeriodInput = {
      period_start: periodStart,
      period_end: periodEnd,
      revenue_target: toNum("revenue"),
      cogs_target: toNum("cogs"),
      opex_target: toNum("opex"),
      net_income_target: toNum("net_income"),
    };

    try {
      await save(activeSlug, payload);
      setSavedMonths((prev) => new Set([...prev, month]));
      setEdits((prev) => {
        const next = new Map(prev);
        for (const key of LINE_ITEMS.map((l) => l.key)) {
          next.delete(`${month}-${key}` as CellKey);
        }
        return next;
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <BudgetLayout title="Budget Builder" subtitle={`Build and edit budgets line by line · ${entityName}`}>
      {/* Notice */}
      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
        <span>
          Targets are pre-filled from {year} actuals where available. Edit any cell, then click a month's{" "}
          <strong>Save</strong> button to write that month for <strong>{entityName}</strong>.
          {source === "loading" && <span className="ml-1 text-emerald-600">Loading…</span>}
        </span>
      </div>

      {(error || saveError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error ?? saveError}
        </div>
      )}

      {/* Month grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap" data-testid="table-budget-builder">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 border-r border-gray-100 min-w-[130px]">
                  Line Item
                </th>
                {MONTHS_LABELS.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide min-w-[90px]"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINE_ITEMS.map(({ key, label }) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-100">
                    {label}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <td key={month} className="px-1.5 py-1">
                      <input
                        type="number"
                        value={getValue(month, key)}
                        onChange={(e) => handleChange(month, key, e.target.value)}
                        placeholder="—"
                        data-testid={`input-${key}-${month}`}
                        className="w-full bg-white border border-gray-200 hover:border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded px-2 py-1 text-right text-gray-800 focus:outline-none transition-colors"
                        min={key !== "net_income" ? "0" : undefined}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {/* Save row */}
              <tr className="bg-gray-50/60">
                <td className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
                  Save
                </td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const isSaved = savedMonths.has(month);
                  return (
                    <td key={month} className="px-1.5 py-1.5 text-center">
                      <button
                        onClick={() => handleSaveMonth(month)}
                        disabled={saving}
                        data-testid={`button-save-${month}`}
                        className={`w-full inline-flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold border transition-colors disabled:opacity-50 ${
                          isSaved
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        <Save className="w-2.5 h-2.5" />
                        {MONTHS_LABELS[month - 1]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Each Save button writes that month independently · existing budgets are updated (upsert) · {year}
      </p>
    </BudgetLayout>
  );
}
