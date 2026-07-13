import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Save, FlaskConical } from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import {
  ALLOCATION_RULES,
  entityAdjustedRows,
  getRule,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import type { AllocationMethod } from "@/lib/analyticsTypes";

const METHODS: AllocationMethod[] = [
  "Fixed Percentage",
  "Equal Split",
  "Revenue Based",
  "Headcount Based",
  "Employee Time Based",
  "Transaction Volume Based",
  "Client Count Based",
  "User Count Based",
  "Square Footage Based",
  "Manual Allocation",
  "Custom Driver",
];

export default function AllocationSimulatorPage() {
  const [ruleId, setRuleId] = useState<string>(ALLOCATION_RULES[0].id);
  const rule = getRule(ruleId)!;

  const [pcts, setPcts] = useState<Record<number, number>>(() =>
    Object.fromEntries(rule.destinations.map((d, i) => [i, d.percentage])),
  );
  const [method, setMethod] = useState<AllocationMethod>(rule.method);

  const onRuleChange = (id: string) => {
    setRuleId(id);
    const r = getRule(id)!;
    setPcts(Object.fromEntries(r.destinations.map((d, i) => [i, d.percentage])));
    setMethod(r.method);
  };

  const reset = () => {
    setPcts(Object.fromEntries(rule.destinations.map((d, i) => [i, d.percentage])));
    setMethod(rule.method);
  };

  const total = Object.values(pcts).reduce((s, v) => s + (v || 0), 0);
  const balanced = Math.abs(total - 100) < 0.01;

  const baseline = useMemo(() => entityAdjustedRows(), []);

  // Delta on adjusted NI per destination entity from percentage changes.
  const deltaByEntity = useMemo(() => {
    const map = new Map<EntitySlug, number>();
    rule.destinations.forEach((d, i) => {
      const orig = d.percentage;
      const next = pcts[i] ?? 0;
      const extraIn = ((next - orig) / 100) * rule.monthlyImpactEstimate;
      // more cost allocated in => lower adjusted NI
      map.set(d.entity, (map.get(d.entity) ?? 0) - extraIn);
    });
    return map;
  }, [rule, pcts]);

  const afterRows = baseline.map((r) => {
    const delta = deltaByEntity.get(r.slug) ?? 0;
    const adjustedNetIncome = r.adjustedNetIncome + delta;
    return {
      slug: r.slug,
      before: r.adjustedNetIncome,
      after: adjustedNetIncome,
      delta,
      revenue: r.bookRevenue,
    };
  });

  return (
    <AnalyticsLayout
      title="Allocation Simulator"
      subtitle="Model what-if allocation scenarios without touching the books."
      showScenario={false}
    >
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 flex items-start gap-2.5">
        <FlaskConical className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-700">
          <span className="font-semibold">Sandbox tool.</span> Changes here never modify accounting
          records or approved allocations. Adjust assumptions to preview economic impact only.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rule editor */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Assumptions</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Allocation Rule
              </label>
              <Select value={ruleId} onValueChange={onRuleChange}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-simulator-rule">
                  <SelectValue placeholder="Select a rule" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOCATION_RULES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Allocation Method
              </label>
              <Select value={method} onValueChange={(v) => setMethod(v as AllocationMethod)}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-simulator-method">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Destination Percentages
                </label>
                <span className="text-[11px] text-gray-400">
                  Monthly impact {fmtMoneyFull(rule.monthlyImpactEstimate)}
                </span>
              </div>
              <div className="space-y-3">
                {rule.destinations.map((d, i) => {
                  const cfg = ENTITY_CONFIG[d.entity];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-28 flex-shrink-0" style={{ color: cfg?.color }}>
                        {cfg?.name ?? d.entity}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={pcts[i] ?? 0}
                        onChange={(e) => setPcts((p) => ({ ...p, [i]: Number(e.target.value) }))}
                        className="flex-1 accent-indigo-600"
                        data-testid={`slider-dest-${i}`}
                      />
                      <div className="w-20 flex-shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={pcts[i] ?? 0}
                          onChange={(e) => setPcts((p) => ({ ...p, [i]: Number(e.target.value) }))}
                          className="h-8 text-sm text-right"
                          data-testid={`input-dest-${i}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                <span className="flex items-center gap-1.5">
                  {!balanced && <AlertTriangle className="w-3.5 h-3.5" />}
                  {balanced ? "Allocation totals 100%" : "Allocation must total 100%"}
                </span>
                <span data-testid="text-allocation-total">{total.toFixed(0)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" className="h-9 gap-1.5" onClick={reset} data-testid="button-simulator-reset">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
              <Button className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700" disabled data-testid="button-simulator-save">
                <Save className="w-3.5 h-3.5" />
                Save as Draft Scenario
              </Button>
              <span className="text-[10px] text-gray-400">Demo — saving disabled</span>
            </div>
          </div>
        </div>

        {/* Before vs after */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Adjusted Net Income — Before vs After</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap" data-testid="table-simulator-impact">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Entity</th>
                  <th className="text-right px-4 py-2.5">Before</th>
                  <th className="text-right px-4 py-2.5">After</th>
                  <th className="text-right px-4 py-2.5">Change</th>
                </tr>
              </thead>
              <tbody>
                {afterRows.map((r) => {
                  const cfg = ENTITY_CONFIG[r.slug];
                  return (
                    <tr key={r.slug} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>
                        {cfg?.name ?? r.slug}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoneyFull(r.before)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoneyFull(r.after)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-500" : "text-gray-400"}`}>
                        {r.delta === 0 ? "—" : `${r.delta > 0 ? "+" : ""}${fmtMoneyFull(r.delta)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-400">
            Baseline = Approved Allocation. After = baseline with your simulated percentages applied to
            the selected rule's monthly impact.
          </div>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
