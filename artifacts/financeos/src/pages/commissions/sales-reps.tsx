import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity, parsePeriod } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepSummary, CommissionRepresentative } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { isHistoricalPeriod } from "@/lib/commission-history";

function useEnvData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted               = useRef(true);
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    fetcher()
      .then((r) => { if (mounted.current) { setData(r.data); setLoading(false); } })
      .catch(()  => { if (mounted.current) setLoading(false); });
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

export default function CommissionSalesRepsPage() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const periodParams  = parsePeriod(activePeriod);
  const isHistorical  = isHistoricalPeriod(activePeriod);

  const { data: repsData,    loading: repsLoading } = useEnvData(
    () => api.commissionRepresentatives(activeSlug),
    [activeSlug],
  );
  const { data: summaryData, loading: sumLoading  } = useEnvData(
    () => api.commissionSummary(activeSlug, periodParams),
    [activeSlug, activePeriod],
  );

  const reps         = (repsData    as CommissionRepresentative[] | null) ?? [];
  const summary      = (summaryData as CommissionRepSummary[]    | null) ?? [];
  const externalReps = reps.filter(r => r.representativeType === "external_rep");
  const houseRep     = reps.find(r => r.representativeType === "internal_house");
  const bySlug       = new Map(summary.map(s => [s.repSlug, s]));
  const ZERO         = { lineCount: 0, totalInvoiceAmount: null, totalGrossProfit: null, totalCommission: null, calculated: 0, approved: 0, locked: 0, needsConfig: 0, needsReview: 0 };
  const repCards     = externalReps.map(rep => bySlug.get(rep.slug) ?? { repSlug: rep.slug, repName: rep.displayName, payoutEligible: true, ...ZERO });
  const houseRow     = summary.find(s => !s.payoutEligible) ?? (houseRep ? { repSlug: houseRep.slug, repName: houseRep.displayName, payoutEligible: false, ...ZERO } : null);
  const loading      = repsLoading || sumLoading;

  return (
    <CommissionLayout title="Sales Reps" subtitle="Sales representative commission performance">

      {isHistorical && (
        <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-700" data-testid="sales-reps-historical-banner">
          <span className="text-slate-400 flex-shrink-0">🗂</span>
          <span>
            <strong>Historical period</strong> — commission data for this month was settled outside FinanceOS.
            Invoice counts and amounts are shown for reference. No action required.
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          {externalReps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">External Representatives</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {repCards.map(rep => {
                  const needsAction = isHistorical ? 0 : rep.needsConfig + rep.needsReview;
                  return (
                    <div key={rep.repSlug} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900 text-[15px]">{rep.repName}</p>
                        {isHistorical ? (
                          <span className="text-[11px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded" data-testid="historical-settled-badge">
                            Historical — Settled
                          </span>
                        ) : needsAction > 0 ? (
                          <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">
                            {needsAction} needs action
                          </span>
                        ) : null}
                      </div>
                      {isHistorical ? (
                        <p className="text-[15px] text-slate-500 font-medium">Historical period settled</p>
                      ) : rep.totalCommission != null ? (
                        <p className="text-2xl font-bold text-gray-900">{fmt(rep.totalCommission)}</p>
                      ) : (
                        <p className="text-xl font-semibold text-amber-600">Not configured</p>
                      )}
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Invoices:</span>
                        <span className="font-medium text-gray-700">{rep.lineCount}</span>
                        <span>Invoiced:</span>
                        <span className="font-medium text-gray-700">{fmt(rep.totalInvoiceAmount)}</span>
                        {!isHistorical && (
                          <>
                            <span>GP (known):</span>
                            <span className="font-medium text-gray-700">{fmt(rep.totalGrossProfit)}</span>
                            <span>Calculated:</span>
                            <span className="font-medium text-gray-700">{rep.calculated}</span>
                            <span>Approved:</span>
                            <span className="font-medium text-gray-700">{rep.approved}</span>
                            <span>Locked:</span>
                            <span className="font-medium text-gray-700">{rep.locked}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {houseRow && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">House</p>
                <p className="text-xl font-bold text-gray-700 mt-0.5">{houseRow.lineCount} invoices</p>
                <p className="text-xs text-gray-400 mt-0.5">Internal — no commission payout</p>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Total invoiced:</span> {fmt(houseRow.totalInvoiceAmount)}
              </div>
              <div className="ml-auto">
                <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">Direct contracts</span>
              </div>
            </div>
          )}

          {externalReps.length === 0 && !houseRow && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-gray-400 text-sm">
              No representatives configured for this entity.
            </div>
          )}
        </>
      )}

    </CommissionLayout>
  );
}
