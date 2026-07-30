import { useState } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepSummary, CommissionRunLine } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useEffect, useRef } from "react";

// ─── Mini fetch hook (no global store needed for commission module) ────────────
function useCommissionData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => { if (mountedRef.current) { setData(res.data); setLoading(false); } })
      .catch((e) => { if (mountedRef.current) { setError(String(e)); setLoading(false); } });
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    attributed:         "bg-blue-100 text-blue-800",
    house_no_commission:"bg-gray-100 text-gray-600",
    needs_configuration:"bg-amber-100 text-amber-800",
    needs_review:       "bg-red-100 text-red-800",
    calculated:         "bg-emerald-100 text-emerald-800",
    awaiting_payment:   "bg-purple-100 text-purple-800",
    ready_for_review:   "bg-indigo-100 text-indigo-800",
    approved:           "bg-green-100 text-green-800",
    locked:             "bg-slate-100 text-slate-700",
    excluded:           "bg-gray-100 text-gray-500",
  };
  const label: Record<string, string> = {
    attributed:         "Attributed",
    house_no_commission:"House",
    needs_configuration:"Needs Config",
    needs_review:       "Needs Review",
    calculated:         "Calculated",
    awaiting_payment:   "Awaiting Payment",
    ready_for_review:   "Ready",
    approved:           "Approved",
    locked:             "Locked",
    excluded:           "Excluded",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return formatCurrency(v);
}

function MiniKpi({ label, value, sub, tone = "blue" }: { label: string; value: string; sub?: string; tone?: "blue" | "emerald" | "amber" | "red" | "gray" }) {
  const colors: Record<string, string> = {
    blue:    "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber:   "border-amber-200 bg-amber-50",
    red:     "border-red-200 bg-red-50",
    gray:    "border-gray-200 bg-gray-50",
  };
  const valColors: Record<string, string> = {
    blue:    "text-blue-900",
    emerald: "text-emerald-900",
    amber:   "text-amber-900",
    red:     "text-red-900",
    gray:    "text-gray-700",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valColors[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CommissionOverviewPage() {
  const { activeSlug } = useCommissionEntity();
  const { data: summary, loading: sumLoading } = useCommissionData(
    () => api.commissionSummary(activeSlug),
    [activeSlug]
  );
  const { data: linesRes, loading: linesLoading } = useCommissionData(
    () => api.commissionLines(activeSlug, { limit: 20 }),
    [activeSlug]
  );

  const lines = (linesRes as { data?: CommissionRunLine[] } | null)?.data ?? (linesRes as CommissionRunLine[] | null) ?? [];

  const externalReps = (summary ?? []).filter((s: CommissionRepSummary) => s.payoutEligible);
  const houseRow     = (summary ?? []).find((s: CommissionRepSummary) => !s.payoutEligible);
  const totalCommission = externalReps.reduce((acc, s: CommissionRepSummary) => acc + (s.totalCommission ?? 0), 0);
  const totalNeedsAction = (summary ?? []).reduce((acc, s: CommissionRepSummary) => acc + s.needsConfig + s.needsReview, 0);
  const totalCalculated = (summary ?? []).reduce((acc, s: CommissionRepSummary) => acc + s.calculated + s.approved + s.locked, 0);

  return (
    <CommissionLayout title="Commission Overview" subtitle="Attribution, calculation and approval for all commission-eligible invoices">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKpi
          label="Confirmed Commission"
          value={sumLoading ? "…" : fmt(totalCommission)}
          sub="Calculated lines only"
          tone="emerald"
        />
        <MiniKpi
          label="Needs Action"
          value={sumLoading ? "…" : String(totalNeedsAction)}
          sub="Missing config or review"
          tone={totalNeedsAction > 0 ? "amber" : "gray"}
        />
        <MiniKpi
          label="Calculated"
          value={sumLoading ? "…" : String(totalCalculated)}
          sub="Lines with a commission amount"
          tone="blue"
        />
        <MiniKpi
          label="House Invoices"
          value={sumLoading ? "…" : String(houseRow?.lineCount ?? 0)}
          sub="No payout — internal"
          tone="gray"
        />
      </div>

      {/* Rep summary cards */}
      {!sumLoading && externalReps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">External Representatives</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {externalReps.map((rep: CommissionRepSummary) => (
              <div key={rep.repSlug} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{rep.repName}</p>
                  {rep.needsConfig + rep.needsReview > 0 && (
                    <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                      {rep.needsConfig + rep.needsReview} needs action
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {rep.totalCommission != null ? fmt(rep.totalCommission) : <span className="text-amber-600 text-lg">Not configured</span>}
                </p>
                <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>Invoices:</span><span className="font-medium text-gray-700">{rep.lineCount}</span>
                  <span>Invoiced:</span><span className="font-medium text-gray-700">{fmt(rep.totalInvoiceAmount)}</span>
                  <span>GP (known):</span><span className="font-medium text-gray-700">{fmt(rep.totalGrossProfit)}</span>
                  <span>Calculated:</span><span className="font-medium text-gray-700">{rep.calculated}</span>
                  <span>Approved:</span><span className="font-medium text-gray-700">{rep.approved}</span>
                  <span>Locked:</span><span className="font-medium text-gray-700">{rep.locked}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* House summary */}
      {!sumLoading && houseRow && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">House</p>
            <p className="text-xl font-bold text-gray-700 mt-0.5">{houseRow.lineCount} invoices</p>
            <p className="text-xs text-gray-400 mt-0.5">Direct contracts — payout = $0.00 (confirmed)</p>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total invoiced:</span> {fmt(houseRow.totalInvoiceAmount)}
          </div>
          <div className="ml-auto">
            <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">payout_eligible = false</span>
          </div>
        </div>
      )}

      {/* Recent lines */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Recent Invoice Lines</h2>
          <a href="./calculations" className="text-xs text-blue-600 hover:underline">View all →</a>
        </div>
        {linesLoading ? (
          <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
        ) : lines.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            <p>No commission lines yet.</p>
            <p className="text-xs mt-1">Run an ingest to pull invoices from the authoritative source.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Rep</th>
                  <th className="px-4 py-2 font-medium text-right">Invoice Amt</th>
                  <th className="px-4 py-2 font-medium text-right">Commission</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(lines as CommissionRunLine[]).slice(0, 20).map((line) => (
                  <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-500">{line.invoiceDate ?? "—"}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{line.customerName ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{line.representativeDisplayName ?? "Unattributed"}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {line.lineStatus === "house_no_commission"
                        ? <span className="text-gray-400">$0.00</span>
                        : line.commissionAmount != null
                          ? <span className="text-emerald-700">{fmt(line.commissionAmount)}</span>
                          : <span className="text-amber-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-2"><StatusBadge status={line.lineStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </CommissionLayout>
  );
}
