import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity, parsePeriod } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepSummary, CommissionRunLine, CommissionRepresentative } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  isHistoricalPeriod,
  isHistoricalInvoice,
  getNextPayoutInfo,
} from "@/lib/commission-history";

function useCommissionData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
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

function StatusBadge({ status, invoiceDate }: { status: string; invoiceDate?: string | null }) {
  if (isHistoricalInvoice(invoiceDate)) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
        Historical — Settled
      </span>
    );
  }
  const tone: Record<string, string> = {
    attributed:          "bg-blue-100 text-blue-800",
    house_no_commission: "bg-gray-100 text-gray-600",
    needs_configuration: "bg-amber-100 text-amber-800",
    needs_review:        "bg-red-100 text-red-800",
    calculated:          "bg-emerald-100 text-emerald-800",
    awaiting_payment:    "bg-purple-100 text-purple-800",
    approved:            "bg-green-100 text-green-800",
    locked:              "bg-slate-100 text-slate-700",
    excluded:            "bg-gray-100 text-gray-500",
  };
  const lbl: Record<string, string> = {
    attributed:          "Attributed",
    house_no_commission: "House",
    needs_configuration: "Needs Config",
    needs_review:        "Needs Review",
    calculated:          "Calculated",
    awaiting_payment:    "Awaiting Payment",
    approved:            "Approved",
    locked:              "Locked",
    excluded:            "Excluded",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${tone[status] ?? "bg-gray-100 text-gray-600"}`}>
      {lbl[status] ?? status}
    </span>
  );
}

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : formatCurrency(n);
}

function MiniKpi({ label, value, sub, tone = "blue" }: {
  label: string; value: string; sub?: string;
  tone?: "blue" | "emerald" | "amber" | "red" | "gray";
}) {
  const bg:  Record<string, string> = { blue: "border-blue-200 bg-blue-50", emerald: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", red: "border-red-200 bg-red-50", gray: "border-gray-200 bg-gray-50" };
  const val: Record<string, string> = { blue: "text-blue-900", emerald: "text-emerald-900", amber: "text-amber-900", red: "text-red-900", gray: "text-gray-700" };
  return (
    <div className={`rounded-xl border px-5 py-4 ${bg[tone]}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${val[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function NextPayoutCard() {
  const { earningMonth, dueMonth, dueMonthShort, dueYear, dueDay } = getNextPayoutInfo();
  return (
    <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 shadow-sm">
      {/* Calendar tile */}
      <div className="flex-shrink-0 w-16 rounded-xl overflow-hidden border border-amber-300 bg-white shadow-sm text-center">
        <div className="bg-amber-500 text-white text-[10px] font-extrabold uppercase tracking-widest py-1 leading-none">
          {dueMonthShort}
        </div>
        <div className="text-[32px] font-black text-amber-900 leading-none py-2">{dueDay}</div>
      </div>
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Next payout</p>
        <p className="text-[15px] font-semibold text-gray-900 mt-0.5">{earningMonth} commissions</p>
        <p className="text-sm text-gray-600 mt-0.5">Due {dueMonth.split(" ")[0]} {dueYear} {dueDay}</p>
        <span className="inline-block mt-2 text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
          Pending
        </span>
      </div>
    </div>
  );
}

export default function CommissionOverviewPage() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const periodParams  = parsePeriod(activePeriod);
  const isHistorical  = isHistoricalPeriod(activePeriod);

  const { data: summary,   loading: sumLoading   } = useCommissionData(
    () => api.commissionSummary(activeSlug, periodParams),
    [activeSlug, activePeriod],
  );
  const { data: linesData, loading: linesLoading } = useCommissionData(
    () => api.commissionLines(activeSlug, { limit: 10, ...periodParams }),
    [activeSlug, activePeriod],
  );
  const { data: repsData,  loading: repsLoading  } = useCommissionData(
    () => api.commissionRepresentatives(activeSlug),
    [activeSlug],
  );

  const lines = (linesData as CommissionRunLine[] | null) ?? [];
  const sortedLines = [...lines].sort((a, b) => {
    const d = (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "");
    if (d !== 0) return d;
    const bT = ((b as Record<string, string | undefined>).updatedAt ?? (b as Record<string, string | undefined>).createdAt ?? "");
    const aT = ((a as Record<string, string | undefined>).updatedAt ?? (a as Record<string, string | undefined>).createdAt ?? "");
    return bT.localeCompare(aT);
  });

  const allReps         = (repsData as CommissionRepresentative[] | null) ?? [];
  const externalReps    = allReps.filter(r => r.representativeType === "external_rep");
  const houseRep        = allReps.find(r => r.representativeType === "internal_house");
  const summaryBySlug   = new Map((summary ?? []).map((s: CommissionRepSummary) => [s.repSlug, s]));
  const ZERO            = { lineCount: 0, totalInvoiceAmount: null, totalGrossProfit: null, totalCommission: null, calculated: 0, approved: 0, locked: 0, needsConfig: 0, needsReview: 0 };
  const repCards        = externalReps.map(rep => summaryBySlug.get(rep.slug) ?? { repSlug: rep.slug, repName: rep.displayName, payoutEligible: true, ...ZERO });
  const houseRow        = (summary ?? []).find((s: CommissionRepSummary) => !s.payoutEligible);
  const houseRowFull    = houseRow ?? (houseRep ? { repSlug: houseRep.slug, repName: houseRep.displayName, payoutEligible: false, ...ZERO } : null);

  const totalCommission  = isHistorical ? 0 : repCards.reduce((acc: number, s) => { const n = parseFloat(s.totalCommission ?? "0"); return acc + (isNaN(n) ? 0 : n); }, 0);
  const totalNeedsAction = isHistorical ? 0 : (summary ?? []).reduce((acc: number, s: CommissionRepSummary) => acc + s.needsConfig + s.needsReview, 0);
  const totalCalculated  = isHistorical ? 0 : (summary ?? []).reduce((acc: number, s: CommissionRepSummary) => acc + s.calculated + s.approved + s.locked, 0);

  return (
    <CommissionLayout title="Commission Overview" subtitle="Attribution, calculation and approval for all commission-eligible invoices">

      {/* Historical period banner */}
      {isHistorical && (
        <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-xl px-5 py-3 text-sm text-slate-700" data-testid="historical-period-banner">
          <span className="text-slate-400 text-base flex-shrink-0">🗂</span>
          <span>
            <strong>Historical period</strong> — commission payouts were handled outside FinanceOS.
            Invoice data is available for reference; no operational action is required.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKpi
          label="Confirmed Commission"
          value={sumLoading ? "…" : isHistorical ? "—" : fmt(totalCommission)}
          sub={isHistorical ? "Historical period" : "Calculated lines only"}
          tone={isHistorical ? "gray" : "emerald"}
        />
        <MiniKpi
          label="Needs Action"
          value={sumLoading ? "…" : String(totalNeedsAction)}
          sub={isHistorical ? "None — historical period" : "Missing config or review"}
          tone={isHistorical ? "gray" : totalNeedsAction > 0 ? "amber" : "gray"}
        />
        <MiniKpi
          label="Calculated"
          value={sumLoading ? "…" : String(totalCalculated)}
          sub="Lines with a commission amount"
          tone={isHistorical ? "gray" : "blue"}
        />
        <MiniKpi
          label="House Invoices"
          value={sumLoading ? "…" : String(houseRow?.lineCount ?? 0)}
          sub="Internal — no payout"
          tone="gray"
        />
      </div>

      {/* Next payout card — always current calendar month, never affected by filter */}
      <NextPayoutCard />

      {/* Rep summary cards */}
      {!sumLoading && !repsLoading && repCards.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">External Representatives</h2>
          {isHistorical ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-600">
              Historical period — representative commission data is settled. No operational action required.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {repCards.map((rep: CommissionRepSummary) => (
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
                    {rep.totalCommission != null
                      ? fmt(rep.totalCommission)
                      : <span className="text-amber-600 text-lg">Not configured</span>}
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
          )}
        </div>
      )}

      {/* House summary */}
      {!sumLoading && !repsLoading && houseRowFull && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap items-center gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">House</p>
            <p className="text-xl font-bold text-gray-700 mt-0.5">{houseRowFull.lineCount} invoices</p>
            <p className="text-xs text-gray-400 mt-0.5">Internal — no commission payout</p>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total invoiced:</span> {fmt(houseRowFull.totalInvoiceAmount)}
          </div>
          <div className="ml-auto">
            <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">Direct contracts</span>
          </div>
        </div>
      )}

      {/* 10 most recent invoice lines */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">10 most recent invoice lines</h2>
          <a href="./calculations" className="text-xs text-blue-600 hover:underline">View all →</a>
        </div>
        {linesLoading ? (
          <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
        ) : sortedLines.length === 0 ? (
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
                {sortedLines.map((line) => {
                  const hist = isHistoricalInvoice(line.invoiceDate);
                  return (
                    <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-500">{line.invoiceDate ?? "—"}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{line.customerName ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{line.representativeDisplayName ?? "Unattributed"}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {hist
                          ? <span className="text-slate-400 italic text-xs">Not tracked</span>
                          : line.lineStatus === "house_no_commission"
                            ? <span className="text-gray-400">$0.00</span>
                            : line.commissionAmount != null
                              ? <span className="text-emerald-700">{fmt(line.commissionAmount)}</span>
                              : <span className="text-amber-500">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={line.lineStatus} invoiceDate={line.invoiceDate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </CommissionLayout>
  );
}
