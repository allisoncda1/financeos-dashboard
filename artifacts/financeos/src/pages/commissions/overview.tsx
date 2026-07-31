import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionKpiSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "@/lib/next-compat";

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : formatCurrency(n);
}

function KpiCard({ label, value, sub, tone = "blue" }: { label: string; value: string; sub?: string; tone?: "blue"|"emerald"|"amber"|"gray" }) {
  const bg: Record<string,string> = { blue:"border-blue-200 bg-blue-50", emerald:"border-emerald-200 bg-emerald-50", amber:"border-amber-200 bg-amber-50", gray:"border-gray-200 bg-gray-50" };
  const vc: Record<string,string> = { blue:"text-blue-900", emerald:"text-emerald-900", amber:"text-amber-900", gray:"text-gray-700" };
  return (
    <div className={`rounded-xl border px-5 py-4 ${bg[tone]}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${vc[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CommissionOverviewPage() {
  const { activeSlug } = useCommissionEntity();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [kpi, setKpi] = useState<CommissionKpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    api.commissionKpiSummary(activeSlug, month)
      .then(d => { if (mounted.current) { setKpi(d); setLoading(false); } })
      .catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [activeSlug, month]);

  const needsAction = kpi?.needsAction ?? 0;

  return (
    <CommissionLayout title="Commission Overview" subtitle="Attribution, calculation and approval for all commission-eligible invoices">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</label>
        <input type="month" className="border border-gray-200 rounded-md px-3 py-1.5 text-sm" value={month} max={currentMonth} onChange={e => { if (e.target.value) setMonth(e.target.value); }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Confirmed Commission" value={loading ? "…" : fmt(kpi?.confirmedCommission)} sub="Approved + locked lines" tone="emerald" />
        <KpiCard label="Needs Action" value={loading ? "…" : String(needsAction)} sub="Missing config or review" tone={needsAction > 0 ? "amber" : "gray"} />
        <KpiCard label="Calculated" value={loading ? "…" : String(kpi?.calculatedCount ?? 0)} sub="Lines with a commission amount" tone="blue" />
        <KpiCard label="Outstanding Invoices" value={loading ? "…" : String(kpi?.outstandingInvoices ?? 0)} sub="Open or Overdue" tone="gray" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">Next Payout</h2>
          <Link href="/commissions/payouts" className="text-xs text-blue-600 hover:underline">View all payouts →</Link>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{loading ? "…" : fmt(kpi?.approvedPayoutTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Approved payout total — awaiting disbursement</p>
          </div>
          {needsAction > 0 && (
            <Link href="/commissions/review" className="ml-auto text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-200 whitespace-nowrap">
              {needsAction} line{needsAction !== 1 ? "s" : ""} need review →
            </Link>
          )}
        </div>
      </div>
    </CommissionLayout>
  );
}
