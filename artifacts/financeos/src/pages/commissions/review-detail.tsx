import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRunLine, ReviewApproveData } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface ActiveRepRule { representativeId: string; status: string; effectiveFrom: string; payableTrigger: string; }
const TRIGGER_LABELS: Record<string,string> = { invoice_issued:"Invoice issued", invoice_paid:"Invoice paid", payment_received:"Payment received", manual_approval:"Manual approval" };
const EXPENSES_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$|^0\.\d{1,2}$/;
const RATE_RE = /^\d{1,3}(?:\.\d{1,4})?$/;

function validateExpenses(v: string): string | null {
  if (v !== v.trim()) return "Remove leading or trailing whitespace";
  if (!EXPENSES_RE.test(v)) return "Enter a valid amount (e.g. 1250.00)";
  return null;
}
function validateRate(v: string): string | null {
  if (v !== v.trim()) return "Remove leading or trailing whitespace";
  if (!RATE_RE.test(v)) return "Enter a rate 0–100 (e.g. 20 for 20%)";
  if (parseFloat(v) > 100) return "Rate must be between 0 and 100";
  return null;
}
function fmt(v: string | null | undefined) { if (v == null) return "—"; const n = parseFloat(v); return isNaN(n) ? "—" : formatCurrency(n); }

export default function CommissionReviewDetailPage() {
  const { activeSlug } = useCommissionEntity();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/commissions/review/:lineId");
  const lineId = match ? params!.lineId : null;
  const [line, setLine] = useState<CommissionRunLine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [derivedTrigger, setDerivedTrigger] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [expenses, setExpenses] = useState("");
  const [rate, setRate] = useState("");
  const [expensesErr, setExpensesErr] = useState<string | null>(null);
  const [rateErr, setRateErr] = useState<string | null>(null);
  const [triggerErr, setTriggerErr] = useState<string | null>(null);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<ReviewApproveData | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    if (!lineId) return;
    mounted.current = true;
    api.commissionLine(activeSlug, lineId)
      .then(l => { if (!mounted.current) return; setLine(l); if (l.expensesAmount) setExpenses(l.expensesAmount); })
      .catch(e => { if (mounted.current) setLoadError(String(e)); });
    return () => { mounted.current = false; };
  }, [activeSlug, lineId]);

  useEffect(() => {
    if (!line?.representativeId) return;
    api.commissionRules(activeSlug)
      .then(res => {
        if (!mounted.current) return;
        const arr: ActiveRepRule[] = Array.isArray(res) ? (res as unknown as ActiveRepRule[]) : ((res as unknown as { data?: ActiveRepRule[] }).data ?? []);
        const active = arr.filter(r => r.representativeId === line.representativeId && r.status === "active").sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        if (active.length > 0) setDerivedTrigger(active[0].payableTrigger);
        setRulesLoaded(true);
      })
      .catch(() => { if (mounted.current) setRulesLoaded(true); });
  }, [activeSlug, line?.representativeId]);

  const effectiveTrigger = derivedTrigger ?? (selectedTrigger || null);

  async function handleSaveDraft() {
    const err = validateExpenses(expenses); setExpensesErr(err);
    if (err || !lineId) return;
    setSaving(true);
    try { await api.commissionReviewDraft(activeSlug, lineId, expenses); }
    catch (e) { if (mounted.current) setExpensesErr(String(e)); }
    finally { if (mounted.current) setSaving(false); }
  }

  async function handleApprove() {
    const eErr = validateExpenses(expenses); const rErr = validateRate(rate);
    setExpensesErr(eErr); setRateErr(rErr); setTriggerErr(null);
    if (eErr || rErr || !lineId) return;
    if (saveForFuture) {
      if (!rulesLoaded) { setTriggerErr("Still loading trigger — please wait"); return; }
      if (!effectiveTrigger) { setTriggerErr("Select a payable trigger to save a future rate"); return; }
      if (!line?.customerName?.trim()) { setTriggerErr("Cannot save future rule — no customer name on this line"); return; }
    }
    setApproving(true);
    try {
      const data = await api.commissionReviewApprove(activeSlug, lineId, {
        expensesAmount: expenses, commissionRate: String(parseFloat(rate) / 100),
        ...(saveForFuture && { saveForFuture: true, representativeId: line?.representativeId ?? undefined, customerNamePattern: line?.customerName?.trim() ?? undefined, payableTrigger: effectiveTrigger! }),
      });
      if (mounted.current) setResult(data);
    } catch (e) { if (mounted.current) setRateErr(String(e)); }
    finally { if (mounted.current) setApproving(false); }
  }

  if (loadError) return <CommissionLayout title="Commission Review" subtitle=""><div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{loadError}</div></CommissionLayout>;
  if (!line || !lineId) return <CommissionLayout title="Commission Review" subtitle=""><p className="text-sm text-gray-400 py-8">Loading…</p></CommissionLayout>;

  if (result) return (
    <CommissionLayout title="Commission Review" subtitle="">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-5 space-y-3">
        <p className="font-semibold text-emerald-800">Invoice approved. Commission: {fmt(result.commissionAmount)}</p>
        {result.warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{result.warning}</p>}
        {result.ruleWarning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{result.ruleWarning}</p>}
        <button onClick={() => setLocation("/commissions/review")} className="text-sm text-blue-600 hover:underline">← Back to Review queue</button>
      </div>
    </CommissionLayout>
  );

  return (
    <CommissionLayout title={`Review: ${line.customerName ?? line.invoiceDocNumber ?? line.id.slice(0,8)}`} subtitle={`${line.representativeDisplayName ?? "Unattributed"} · ${line.invoiceDate ?? ""}`}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div><span className="text-gray-500">Customer</span><span className="ml-2 font-medium text-gray-900">{line.customerName ?? "—"}</span></div>
        <div><span className="text-gray-500">Invoice Amount</span><span className="ml-2 font-medium text-gray-900">{fmt(line.invoiceAmount)}</span></div>
        <div><span className="text-gray-500">Date</span><span className="ml-2 text-gray-700">{line.invoiceDate ?? "—"}</span></div>
        <div><span className="text-gray-500">Invoice Status</span><span className="ml-2 text-gray-700">{line.invoiceStatus ?? "—"}</span></div>
        <div><span className="text-gray-500">Rep</span><span className="ml-2 text-gray-700">{line.representativeDisplayName ?? "Unattributed"}</span></div>
        <div><span className="text-gray-500">Line Status</span><span className="ml-2 text-gray-700">{line.lineStatus}</span></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Enter Review Inputs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Expenses / Cost of Sale ($)</label>
            <input type="text" inputMode="decimal" placeholder="0.00" value={expenses} onChange={e => { setExpenses(e.target.value); setExpensesErr(null); }} className={`w-full border rounded-md px-3 py-2 text-sm ${expensesErr ? "border-red-400" : "border-gray-300"}`} />
            {expensesErr && <p className="text-xs text-red-600 mt-1">{expensesErr}</p>}
            <button onClick={handleSaveDraft} disabled={saving} className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50">{saving ? "Saving…" : "Save draft"}</button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Commission Rate (%)</label>
            <input type="text" inputMode="decimal" placeholder="e.g. 20" value={rate} onChange={e => { setRate(e.target.value); setRateErr(null); }} className={`w-full border rounded-md px-3 py-2 text-sm ${rateErr ? "border-red-400" : "border-gray-300"}`} />
            {rateErr && <p className="text-xs text-red-600 mt-1">{rateErr}</p>}
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={saveForFuture} onChange={e => { setSaveForFuture(e.target.checked); setTriggerErr(null); }} className="rounded border-gray-300" />
            Save this rate for future invoices from this customer
          </label>
          {saveForFuture && (
            <div className="ml-6 space-y-1">
              {derivedTrigger ? (
                <p className="text-xs text-gray-600">Payable trigger: <span className="font-medium">{TRIGGER_LABELS[derivedTrigger] ?? derivedTrigger}</span><span className="text-gray-400 ml-1">(from existing rule)</span></p>
              ) : rulesLoaded ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Payable trigger <span className="text-red-500">*</span></label>
                  <select value={selectedTrigger} onChange={e => { setSelectedTrigger(e.target.value); setTriggerErr(null); }} className={`border rounded-md px-3 py-2 text-sm ${triggerErr ? "border-red-400" : "border-gray-300"}`}>
                    <option value="">Select trigger…</option>
                    <option value="invoice_issued">Invoice issued</option>
                    <option value="invoice_paid">Invoice paid</option>
                    <option value="payment_received">Payment received</option>
                    <option value="manual_approval">Manual approval</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">No existing rule for this rep — select explicitly.</p>
                </div>
              ) : <p className="text-xs text-gray-400">Loading trigger…</p>}
              {triggerErr && <p className="text-xs text-red-600">{triggerErr}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleApprove} disabled={approving || (saveForFuture && !rulesLoaded)} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {approving ? "Approving…" : "Approve Commission"}
          </button>
          <button onClick={() => setLocation("/commissions/review")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </CommissionLayout>
  );
}
