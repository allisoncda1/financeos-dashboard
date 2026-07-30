/**
 * Commission Rule Builder
 * Secure UI for configuring commission formulas.
 * Formula types are a closed enum — no free code execution.
 * All rules require explicit confirmation + preview before activation.
 */
import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepresentative, CommissionRule, CommissionRulePreview, CommissionRuleInput } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

function useData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    fetcher()
      .then((r) => { if (mounted.current) { setData(r.data); setLoading(false); } })
      .catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}

const FORMULA_TYPES = [
  { value: "percentage_of_invoice",       label: "% of Invoice Amount" },
  { value: "percentage_of_amount_paid",   label: "% of Amount Paid" },
  { value: "percentage_of_gross_profit",  label: "% of Gross Profit" },
  { value: "fixed_amount",                label: "Fixed Amount" },
  { value: "manual",                      label: "Manual Entry" },
  { value: "no_commission_house",         label: "House — No Commission" },
];

const TRIGGERS = [
  { value: "invoice_issued",   label: "Invoice Issued" },
  { value: "invoice_paid",     label: "Invoice Paid" },
  { value: "payment_received", label: "Payment Received" },
  { value: "manual_approval",  label: "Manual Approval" },
];

function fmt(v: number | null | undefined) {
  return v == null ? "—" : formatCurrency(v);
}

function RuleCard({ rule, repName }: { rule: CommissionRule; repName: string }) {
  const fmtRate = rule.commissionRate != null ? `${(rule.commissionRate * 100).toFixed(2)}%` : "—";
  const fmtFixed = rule.fixedAmount != null ? fmt(rule.fixedAmount) : null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">{repName}</p>
        <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">v{rule.ruleVersion} · {rule.status}</span>
      </div>
      {rule.customerNamePattern && (
        <p className="text-xs text-gray-500">Scope: <span className="font-mono text-gray-700">{rule.customerNamePattern}</span></p>
      )}
      <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4">
        <span>Formula:</span><span className="font-medium text-gray-700">{FORMULA_TYPES.find(f => f.value === rule.formulaType)?.label ?? rule.formulaType}</span>
        <span>Rate:</span><span className="font-medium text-gray-700">{fmtFixed ?? fmtRate}</span>
        <span>Trigger:</span><span className="font-medium text-gray-700">{TRIGGERS.find(t => t.value === rule.payableTrigger)?.label ?? rule.payableTrigger}</span>
        <span>Effective:</span><span className="font-medium text-gray-700">{rule.effectiveFrom}{rule.effectiveTo ? ` → ${rule.effectiveTo}` : " (no end)"}</span>
      </div>
      {rule.notes && <p className="text-xs italic text-gray-400 mt-1">{rule.notes}</p>}
    </div>
  );
}

export default function CommissionPlansPage() {
  const { activeSlug } = useCommissionEntity();

  const { data: repsData, loading: repsLoading } = useData(
    () => api.commissionRepresentatives(activeSlug),
    [activeSlug]
  );
  const reps = (repsData as CommissionRepresentative[] | null) ?? [];

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  const loadRules = () => {
    setRulesLoading(true);
    (api.commissionRules(activeSlug) as Promise<{ data: CommissionRule[] }>)
      .then((r) => { setRules(r.data ?? []); setRulesLoading(false); })
      .catch(() => setRulesLoading(false));
  };
  useEffect(loadRules, [activeSlug]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<CommissionRuleInput>({
    representativeId: "",
    customerNamePattern: "",
    formulaType: "percentage_of_gross_profit",
    calculationBasis: "gross_profit",
    commissionRate: null,
    fixedAmount: null,
    payableTrigger: "invoice_paid",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    notes: "",
  });

  const [preview, setPreview]     = useState<CommissionRulePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  const needsRate  = ["percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit"].includes(form.formulaType);
  const needsFixed = form.formulaType === "fixed_amount";

  function setField<K extends keyof CommissionRuleInput>(key: K, value: CommissionRuleInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setPreview(null);
    setConfirmed(false);
    setSaved(false);
    setError(null);
  }

  async function handlePreview() {
    if (!form.representativeId) { setError("Select a representative first."); return; }
    setPreviewing(true);
    setError(null);
    try {
      const res = await api.commissionRulePreview(activeSlug, form) as unknown as { data: CommissionRulePreview };
      setPreview(res.data);
    } catch (e) {
      setError(String(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!confirmed) { setError("Check the confirmation box before saving."); return; }
    setSaving(true);
    setError(null);
    try {
      await api.createCommissionRule(activeSlug, {
        ...form,
        effectiveFrom: form.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      });
      setSaved(true);
      setPreview(null);
      setConfirmed(false);
      setForm((prev) => ({ ...prev, notes: "" }));
      loadRules();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const repById = new Map(reps.map((r) => [r.id, r]));

  return (
    <CommissionLayout title="Rule Builder" subtitle="Configure commission formulas per representative and client">

      {/* Existing rules */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Active Rules</h2>
        {rulesLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rules.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
            No commission rules configured yet. All external rep lines will show <strong>needs_configuration</strong> until rules are added below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                repName={repById.get(rule.representativeId)?.displayName ?? rule.representativeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rule builder form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-6 space-y-5">
        <h2 className="text-base font-bold text-gray-900">Create New Rule</h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Rules are versioned. Saving will supersede any existing active rule for the same rep + customer scope.
          Always preview before saving.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Representative */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Representative *</label>
            {repsLoading ? <p className="text-sm text-gray-400">Loading…</p> : (
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.representativeId}
                onChange={(e) => setField("representativeId", (e.target as HTMLSelectElement).value)}
              >
                <option value="">— Select —</option>
                {reps.filter(r => r.representativeType === "external_rep").map((r) => (
                  <option key={r.id} value={r.id}>{r.displayName}</option>
                ))}
              </select>
            )}
          </div>

          {/* Customer scope */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Customer Scope <span className="text-gray-400 font-normal">(leave blank = all customers for this rep)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Metro Honda  or  James CDJR%"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.customerNamePattern ?? ""}
              onInput={(e) => setField("customerNamePattern", (e.target as HTMLInputElement).value || null)}
            />
            <p className="text-[11px] text-gray-400">Supports SQL-style wildcards: % matches any sequence, _ matches one character.</p>
          </div>

          {/* Formula type */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Formula Type *</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.formulaType}
              onChange={(e) => setField("formulaType", (e.target as HTMLSelectElement).value)}
            >
              {FORMULA_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {/* Rate or fixed */}
          {needsRate && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Commission Rate (%)</label>
              <input
                type="number"
                min="0" max="100" step="0.01"
                placeholder="e.g. 20"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.commissionRate != null ? form.commissionRate * 100 : ""}
                onInput={(e) => {
                  const pct = parseFloat((e.target as HTMLInputElement).value);
                  setField("commissionRate", isNaN(pct) ? null : pct / 100);
                }}
              />
              <p className="text-[11px] text-gray-400">Enter as percentage, e.g. 20 = 20%</p>
            </div>
          )}
          {needsFixed && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fixed Amount ($)</label>
              <input
                type="number"
                min="0" step="0.01"
                placeholder="e.g. 500.00"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.fixedAmount ?? ""}
                onInput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  setField("fixedAmount", isNaN(v) ? null : v);
                }}
              />
            </div>
          )}

          {/* Payable trigger */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Payable Trigger *</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.payableTrigger}
              onChange={(e) => setField("payableTrigger", (e.target as HTMLSelectElement).value)}
            >
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Effective from */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Effective From *</label>
            <input
              type="date"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.effectiveFrom ?? ""}
              onInput={(e) => setField("effectiveFrom", (e.target as HTMLInputElement).value)}
            />
          </div>

          {/* Effective to */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Effective To <span className="text-gray-400 font-normal">(leave blank = no expiry)</span></label>
            <input
              type="date"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.effectiveTo ?? ""}
              onInput={(e) => setField("effectiveTo", (e.target as HTMLInputElement).value || null)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes / Reason</label>
            <input
              type="text"
              placeholder="e.g. Agreed rate per contract Apr 2026"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.notes ?? ""}
              onInput={(e) => setField("notes", (e.target as HTMLInputElement).value || null)}
            />
          </div>
        </div>

        {/* Preview button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={previewing || !form.representativeId}
            className="text-sm bg-gray-800 hover:bg-gray-900 text-white font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {previewing ? "Calculating preview…" : "Preview Impact"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Preview panel */}
        {preview && (
          <div className="border border-blue-200 bg-blue-50 rounded-xl px-5 py-4 space-y-3">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Affected lines</p>
                <p className="text-2xl font-bold text-blue-900">{preview.affectedCount}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Projected total</p>
                <p className="text-2xl font-bold text-blue-900">{preview.projectedTotal != null ? fmt(preview.projectedTotal) : "—"}</p>
              </div>
            </div>
            {preview.lines.length > 0 && (
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-blue-600 text-[10px] uppercase border-b border-blue-200">
                      <th className="py-1 pr-3">Customer</th>
                      <th className="py-1 pr-3">Date</th>
                      <th className="py-1 pr-3 text-right">Invoice</th>
                      <th className="py-1 pr-3 text-right">Current Comm.</th>
                      <th className="py-1 pr-3 text-right">Projected Comm.</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.slice(0, 50).map((l, i) => (
                      <tr key={i} className="border-b border-blue-100">
                        <td className="py-1 pr-3 text-gray-800 max-w-[150px] truncate">{l.customerName ?? "—"}</td>
                        <td className="py-1 pr-3 text-gray-500">{l.invoiceDate ?? "—"}</td>
                        <td className="py-1 pr-3 text-right text-gray-700">{fmt(l.invoiceAmount)}</td>
                        <td className="py-1 pr-3 text-right text-gray-500">{fmt(l.currentCommission)}</td>
                        <td className="py-1 pr-3 text-right font-semibold text-blue-800">{fmt(l.projectedCommission)}</td>
                        <td className="py-1 text-xs text-gray-500">{l.projectedStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.lines.length > 50 && (
                  <p className="text-[11px] text-blue-500 mt-1">…and {preview.lines.length - 50} more lines</p>
                )}
              </div>
            )}

            {/* Confirmation + save */}
            <div className="flex items-center gap-3 pt-2 border-t border-blue-200">
              <label className="flex items-center gap-2 text-sm text-blue-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed((e.target as HTMLInputElement).checked)}
                  className="w-4 h-4 rounded border-blue-400 text-blue-600"
                />
                I have reviewed the preview and confirm this rule should be activated.
              </label>
              <button
                onClick={handleSave}
                disabled={saving || !confirmed}
                className="ml-auto text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Activate Rule"}
              </button>
            </div>
            {saved && (
              <p className="text-sm text-emerald-700 font-semibold">Rule saved successfully. Lines will be recalculated on next sync.</p>
            )}
          </div>
        )}
      </div>
    </CommissionLayout>
  );
}
