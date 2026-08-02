import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionKpiSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "@/lib/next-compat";

function fmt(v: string | number | null | undefined) {
  if (v == null) return "$0.00";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0.00";
  return formatCurrency(n);
}

function KpiCard({ label, value, sub, tone = "blue" }: {
  label: string; value: string; sub?: string;
  tone?: "blue" | "emerald" | "amber" | "gray";
}) {
  const bg: Record<string, string> = { blue: "border-blue-200 bg-blue-50", emerald: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", gray: "border-gray-200 bg-gray-50" };
  const vc: Record<string, string> = { blue: "text-blue-900", emerald: "text-emerald-900", amber: "text-amber-900", gray: "text-gray-700" };
  return (
    <div className={`rounded-xl border px-5 py-4 ${bg[tone]}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${vc[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Given a "YYYY-MM" commission month, return the due date: 5th of the following month. */
function getPayoutDue(month: string): { dueDay: number; dueMonthAbbr: string; dueLabel: string; commissionLabel: string } {
  const [y, m] = month.split("-").map(Number);
  const dueMonth = m === 12 ? 1 : m + 1;
  const dueYear  = m === 12 ? y + 1 : y;
  const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return {
    dueDay:        5,
    dueMonthAbbr:  MONTHS[dueMonth - 1].toUpperCase(),
    dueLabel:      `Due ${MONTHS_FULL[dueMonth - 1]} 5, ${dueYear}`,
    commissionLabel: `${MONTHS_FULL[m - 1]} ${y} commissions`,
  };
}

function NextPayoutCard({ month, approvedTotal, loading, needsAction }: {
  month: string; approvedTotal: string | undefined; loading: boolean; needsAction: number;
}) {
  const { dueDay, dueMonthAbbr, dueLabel, commissionLabel } = getPayoutDue(month);
  const amount = loading ? null : (approvedTotal ?? "0");

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        {/* Calendar tile */}
        <div className="flex flex-col items-center justify-center bg-emerald-600 text-white px-6 py-5 min-w-[96px]">
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{dueMonthAbbr}</span>
          <span className="text-5xl font-black leading-none mt-0.5">{dueDay}</span>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Next Payout</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{commissionLabel}</p>
            <p className="text-xs text-gray-500 mt-0.5">{dueLabel}</p>
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Approved total</p>
              <p className="text-2xl font-bold text-emerald-700 mt-0.5">
                {amount === null ? "…" : fmt(amount)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Link href="/commissions/payouts" className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap">
                View payouts →
              </Link>
              {needsAction > 0 && (
                <Link href="/commissions/review" className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 whitespace-nowrap">
                  {needsAction} line{needsAction !== 1 ? "s" : ""} need review
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommissionOverviewPage() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const currentMonth   = new Date().toISOString().slice(0, 7);
  const month = activePeriod ?? currentMonth;
  const [kpi, setKpi]     = useState<CommissionKpiSummary | null>(null);
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
        
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Confirmed Commission" value={loading ? "…" : fmt(kpi?.confirmedCommission)} sub="Approved + locked lines" tone="emerald" />
        <KpiCard label="Needs Action"         value={loading ? "…" : String(needsAction)}            sub="Missing config or review" tone={needsAction > 0 ? "amber" : "gray"} />
        <KpiCard label="Calculated"           value={loading ? "…" : String(kpi?.calculatedCount ?? 0)} sub="Lines with a commission amount" tone="blue" />
        <KpiCard label="Outstanding Invoices" value={loading ? "…" : String(kpi?.outstandingInvoices ?? 0)} sub="Open or Overdue" tone="gray" />
      </div>

      <NextPayoutCard
        month={month}
        approvedTotal={kpi?.approvedPayoutTotal}
        loading={loading}
        needsAction={needsAction}
      />
    </CommissionLayout>
  );
}
