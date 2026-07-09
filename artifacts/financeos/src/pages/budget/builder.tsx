import { useState, useCallback } from "react";
import { useEntityBudget, useBudgetMutation } from "@/hooks/useApi";
import { useBudgetEntity } from "@/lib/budget-context";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { PencilLine, Save, AlertCircle } from "lucide-react";
import type { BudgetPeriodInput } from "@/lib/types";

const MONTHS_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type CellKey = `${number}-${"revenue" | "cogs" | "opex" | "net_income"}`;
type EditMap = Map<CellKey, string>;

const LINE_ITEMS = [
  { key: "revenue",    label: "Revenue" },
  { key: "cogs",       label: "COGS" },
  { key: "opex",       label: "Opex" },
  { key: "net_income", label: "Net Income" },
] as const;

export default function BudgetBuilderPage() {
  const { activeSlug, setActiveSlug } = useBudgetEntity();
  const { data, source } = useEntityBudget(activeSlug);
  const { save, saving, error } = useBudgetMutation();

  const [edits, setEdits] = useState<EditMap>(new Map());
  const [savedMonths, setSavedMonths] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const year = data?.year ?? new Date().getFullYear();

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

  const handleSaveMonth = useCallback(
    async (month: number) => {
      setSaveError(null);
      const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const periodEnd   = lastDayOfMonth(year, month);

      const toNum = (key: string): number | null => {
        const v = getValue(month, key);
        if (v === "" || v === null) return null;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };

      const payload: BudgetPeriodInput = {
        period_start:      periodStart,
        period_end:        periodEnd,
        revenue_target:    toNum("revenue"),
        cogs_target:       toNum("cogs"),
        opex_target:       toNum("opex"),
        net_income_target: toNum("net_income"),
      };

      try {
        await save(activeSlug, payload);
        setSavedMonths((prev) => new Set([...prev, month]));
        // Clear edits for this month
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
    },
    [activeSlug, edits, year, save],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PencilLine className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Budget Builder</h1>
          {source === "loading" && <span className="text-xs text-white/40">Loading…</span>}
        </div>

        <select
          value={activeSlug}
          onChange={(e) => setActiveSlug(e.target.value as EntitySlug)}
          className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500/50"
        >
          {ENTITY_SLUGS.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {ENTITY_CONFIG[s]?.name ?? s}
            </option>
          ))}
        </select>
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex gap-2 text-sm text-amber-300">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Targets are pre-filled from {year} actuals where available. Edit any cell, then click Save to write that month.
          You are editing: <strong>{ENTITY_CONFIG[activeSlug]?.name ?? activeSlug}</strong>
        </span>
      </div>

      {(error || saveError) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? saveError}
        </div>
      )}

      {/* Month grid */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-xs min-w-[860px]">
          <thead>
            <tr className="border-b border-white/10 text-white/50 uppercase tracking-wide">
              <th className="text-left px-3 py-2.5 w-28">Line Item</th>
              {MONTHS_LABELS.map((m) => (
                <th key={m} className="text-right px-2 py-2.5">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINE_ITEMS.map(({ key, label }) => (
              <tr key={key} className="border-b border-white/5">
                <td className="px-3 py-2 text-white/70 font-medium">{label}</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <td key={month} className="px-1 py-1">
                    <input
                      type="number"
                      value={getValue(month, key)}
                      onChange={(e) => handleChange(month, key, e.target.value)}
                      placeholder="—"
                      className="w-full bg-white/5 border border-transparent hover:border-white/10 focus:border-emerald-500/50 rounded px-1.5 py-1 text-right text-white/80 focus:outline-none focus:bg-white/10 transition-colors"
                      min={key !== "net_income" ? "0" : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {/* Save row */}
            <tr>
              <td className="px-3 py-2 text-white/40 text-xs">Save</td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <td key={month} className="px-1 py-1 text-center">
                  <button
                    onClick={() => handleSaveMonth(month)}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: savedMonths.has(month) ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
                      color: savedMonths.has(month) ? "#34d399" : "rgba(255,255,255,0.50)",
                      border: `1px solid ${savedMonths.has(month) ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <Save className="w-2.5 h-2.5" />
                    {MONTHS_LABELS[month - 1]}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/30">
        Each Save button writes that month independently · ON CONFLICT DO NOTHING — existing budgets are updated on save
      </p>
    </div>
  );
}
