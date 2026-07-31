import { useState, useEffect, useRef } from "react";
import { useCommissionEntity, parsePeriod } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRunLine, CommissionRepresentative } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { isHistoricalInvoice } from "@/lib/commission-history";

const LINE_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "needs_configuration", label: "Needs Config" },
  { value: "needs_review", label: "Needs Review" },
  { value: "calculated", label: "Calculated" },
  { value: "house_no_commission", label: "House" },
  { value: "approved", label: "Approved" },
  { value: "locked", label: "Locked" },
];

const STATUS_TONE: Record<string, string> = {
  attributed:          "bg-blue-100 text-blue-800",
  house_no_commission: "bg-gray-100 text-gray-600",
  needs_configuration: "bg-amber-100 text-amber-800",
  needs_review:        "bg-red-100 text-red-800",
  calculated:          "bg-emerald-100 text-emerald-800",
  approved:            "bg-green-100 text-green-800",
  locked:              "bg-slate-100 text-slate-700",
};
const STATUS_LABEL: Record<string, string> = {
  attributed:          "Attributed",
  house_no_commission: "House",
  needs_configuration: "Needs Config",
  needs_review:        "Needs Review",
  calculated:          "Calculated",
  approved:            "Approved",
  locked:              "Locked",
};

function Pill({ status, invoiceDate }: { status: string; invoiceDate?: string | null }) {
  if (isHistoricalInvoice(invoiceDate)) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600"
            data-testid="historical-line-badge">
        Historical — Settled
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_TONE[status] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : formatCurrency(n);
}

function useData<T>(fetcher: () => Promise<{ data: T }>, deps: unknown[]) {
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

export function CommissionStatusTable() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const periodParams = parsePeriod(activePeriod);

  const [statusFilter, setStatusFilter] = useState("");
  const [repFilter,    setRepFilter]    = useState("");

  const { data: repsData } = useData(
    () => api.commissionRepresentatives(activeSlug),
    [activeSlug],
  );
  const reps = (repsData as CommissionRepresentative[] | null) ?? [];

  const [lines,   setLines]   = useState<CommissionRunLine[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (api.commissionLines(activeSlug, {
      representativeId: repFilter   || undefined,
      lineStatus:       statusFilter || undefined,
      limit: 200,
      ...periodParams,
    }) as Promise<{ data: CommissionRunLine[]; total: number }>)
      .then((res) => { setLines(res.data ?? []); setTotal(res.total ?? 0); setLoading(false); })
      .catch(()   => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug, activePeriod, statusFilter, repFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
        >
          {LINE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none"
          value={repFilter}
          onChange={(e) => setRepFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">All reps</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.displayName}</option>)}
        </select>
        <span className="text-xs text-gray-400">{loading ? "…" : `${total} lines`}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {loading ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">Loading…</p>
        ) : lines.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            <p>No lines found.</p>
            <p className="text-xs mt-1">Use Import Invoices to pull from the authoritative source, or adjust filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Invoice #</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Rep</th>
                  <th className="px-4 py-2.5 font-medium">Inv. Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">GP</th>
                  <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const hist = isHistoricalInvoice(line.invoiceDate);
                  return (
                    <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-500">{line.invoiceDate ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{line.invoiceDocNumber ?? "—"}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 max-w-[180px] truncate">{line.customerName ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {line.representativeDisplayName ?? <span className="text-gray-400 italic text-xs">Unattributed</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[11px] font-medium ${
                          line.invoiceStatus === "Paid"    ? "text-emerald-700" :
                          line.invoiceStatus === "Overdue" ? "text-red-600"     : "text-gray-500"
                        }`}>{line.invoiceStatus ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {line.grossProfit != null
                          ? fmt(line.grossProfit)
                          : <span className="italic text-gray-300 text-xs">unknown</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {hist ? (
                          <span className="text-slate-400 italic text-xs">Not tracked</span>
                        ) : line.lineStatus === "house_no_commission" ? (
                          <span className="text-gray-400">$0.00</span>
                        ) : line.commissionAmount != null ? (
                          <span className="text-emerald-700">{fmt(line.commissionAmount)}</span>
                        ) : (
                          <span className="text-amber-400 italic text-xs">
                            {line.exclusionReason === "missing_gross_profit"       ? "GP missing" :
                             line.exclusionReason === "missing_commission_formula" ? "No rule"    : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Pill status={line.lineStatus} invoiceDate={line.invoiceDate} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
