import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepresentative, CommissionRepSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

function useEnvData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
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

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : formatCurrency(n);
}

export default function SalesRepsPage() {
  const { activeSlug } = useCommissionEntity();

  const { data: repsRaw, loading: repsLoading } = useEnvData(
    () => api.commissionRepresentatives(activeSlug),
    [activeSlug]
  );
  const { data: summaryRaw, loading: sumLoading } = useEnvData(
    () => api.commissionSummary(activeSlug),
    [activeSlug]
  );

  const reps    = (repsRaw    as CommissionRepresentative[] | null) ?? [];
  const summary = (summaryRaw as CommissionRepSummary[]    | null) ?? [];

  const summaryBySlug  = new Map(summary.map((s) => [s.repSlug, s]));
  const externalReps   = reps.filter(r => r.representativeType === "external_rep");
  const houseRep       = reps.find(r => r.representativeType === "internal_house");
  const houseSummary   = summary.find(s => !s.payoutEligible);
  const loading        = repsLoading || sumLoading;

  return (
    <CommissionLayout title="Sales Reps" subtitle="Commission performance per representative">
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          {externalReps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">External Representatives</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {externalReps.map((rep) => {
                  const s = summaryBySlug.get(rep.slug);
                  const needsAction = (s?.needsConfig ?? 0) + (s?.needsReview ?? 0);
                  return (
                    <div key={rep.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{rep.displayName}</p>
                        {needsAction > 0 && (
                          <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                            {needsAction} needs action
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold">
                        {s?.totalCommission != null
                          ? <span className="text-emerald-700">{fmt(s.totalCommission)}</span>
                          : <span className="text-amber-500 text-lg">Not configured</span>}
                      </p>
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Invoices:</span><span className="font-medium text-gray-700">{s?.lineCount ?? 0}</span>
                        <span>Invoiced:</span><span className="font-medium text-gray-700">{fmt(s?.totalInvoiceAmount)}</span>
                        <span>Calculated:</span><span className="font-medium text-gray-700">{s?.calculated ?? 0}</span>
                        <span>Approved:</span><span className="font-medium text-gray-700">{s?.approved ?? 0}</span>
                        <span>Needs Config:</span><span className="font-medium text-amber-600">{s?.needsConfig ?? 0}</span>
                        <span>Needs Review:</span><span className="font-medium text-red-500">{s?.needsReview ?? 0}</span>
                      </div>
                      <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">
                        payout_eligible = true
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(houseRep ?? houseSummary) && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">House (Internal)</h2>
              <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-8">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">House</p>
                  <p className="text-xl font-bold text-gray-700 mt-0.5">{houseRep?.displayName ?? "House"}</p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Invoices:</span> {houseSummary?.lineCount ?? 0}</p>
                  <p><span className="font-medium">Total invoiced:</span> {fmt(houseSummary?.totalInvoiceAmount)}</p>
                  <p><span className="font-medium">Commission payout:</span> <span className="text-gray-400">$0.00 — direct contracts</span></p>
                </div>
                <div className="ml-auto">
                  <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">payout_eligible = false</span>
                </div>
              </div>
            </div>
          )}

          {externalReps.length === 0 && !houseRep && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-400 text-sm">
              No representatives configured for this entity.
            </div>
          )}
        </div>
      )}
    </CommissionLayout>
  );
}
