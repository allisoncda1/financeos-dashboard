import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { parsePeriod, useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRepresentative, CommissionRunLine } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "@/lib/next-compat";

function fmt(v: string | null | undefined) { if (v == null) return "—"; const n = parseFloat(v); return isNaN(n) ? "—" : formatCurrency(n); }
function fmtRate(v: string | null | undefined) { if (v == null) return "—"; const n = parseFloat(v) * 100; return isNaN(n) ? "—" : `${n.toFixed(2)}%`; }

const STATUS_COLORS: Record<string, string> = {
  needs_review: "bg-red-100 text-red-800", needs_configuration: "bg-amber-100 text-amber-800",
  calculated: "bg-emerald-100 text-emerald-800", approved: "bg-green-100 text-green-800",
  locked: "bg-slate-100 text-slate-700", awaiting_payment: "bg-purple-100 text-purple-800",
  excluded: "bg-gray-100 text-gray-500", attributed: "bg-blue-100 text-blue-800",
  house_no_commission: "bg-slate-100 text-slate-700",
};
const STATUS_LABELS: Record<string, string> = {
  needs_review: "Needs Review", needs_configuration: "Needs Config", calculated: "Calculated",
  approved: "Approved", locked: "Locked", awaiting_payment: "Awaiting Payment",
  excluded: "Excluded", attributed: "Attributed",
  house_no_commission: "House — No Commission",
};

export default function CommissionSalesRepDetailPage() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const periodParams = parsePeriod(activePeriod);
  const [, navigate]   = useLocation();
  const [match, params] = useRoute("/commissions/sales-reps/:repId");
  const repId = match ? params!.repId : null;

  const [rep, setRep]     = useState<CommissionRepresentative | null>(null);
  const [lines, setLines] = useState<CommissionRunLine[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    if (!repId) return;
    mounted.current = true;
    setLoading(true);
    Promise.all([
      api.commissionRepresentatives(activeSlug),
      api.commissionLines(activeSlug, { representativeId: repId, limit: 500, ...periodParams }),
    ]).then(([repsRes, linesRes]) => {
      if (!mounted.current) return;
      const reps = Array.isArray(repsRes) ? (repsRes as CommissionRepresentative[]) : ((repsRes as { data?: CommissionRepresentative[] }).data ?? []);
      setRep(reps.find(r => r.id === repId) ?? null);
      const data = Array.isArray(linesRes) ? (linesRes as CommissionRunLine[]) : ((linesRes as { data?: CommissionRunLine[] }).data ?? []);
      setLines(data);
      setLoading(false);
    }).catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [activeSlug, repId, activePeriod]);

  const invoiceTotal  = lines.reduce((a, l) => { const n = parseFloat(l.invoiceAmount ?? "0"); return a + (isNaN(n) ? 0 : n); }, 0);
  const commTotal     = lines.filter(l => l.lineStatus === "approved" || l.lineStatus === "locked").reduce((a, l) => { const n = parseFloat(l.commissionAmount ?? "0"); return a + (isNaN(n) ? 0 : n); }, 0);
  const needsAction   = lines.filter(l => l.lineStatus === "needs_review" || l.lineStatus === "needs_configuration").length;

  if (!repId) return null;

  return (
    <CommissionLayout
      title={loading ? "Loading…" : (rep?.displayName ?? "Representative")}
      subtitle={`${activeSlug} · ${activePeriod ?? "All time"}`}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/commissions/sales-reps")}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ← Sales Reps
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[["Invoiced", formatCurrency(invoiceTotal), "blue"], ["Approved Commission", formatCurrency(commTotal), "emerald"], ["Needs Action", String(needsAction), needsAction > 0 ? "amber" : "gray"]].map(([label, value, tone]) => (
          <div key={label} className={`rounded-xl border px-5 py-4 ${tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "blue" ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tone === "emerald" ? "text-emerald-900" : tone === "amber" ? "text-amber-900" : tone === "blue" ? "text-blue-900" : "text-gray-700"}`}>{loading ? "…" : value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Invoice Lines</h2>
          <span className="text-xs text-gray-400">{loading ? "…" : `${lines.length} lines`}</span>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-gray-400">Loading…</p> : lines.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm"><p>No lines for this period.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-gray-100 text-left text-[10px] text-gray-400 uppercase tracking-wide">
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Invoice #</th><th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Acct Status</th><th className="px-3 py-2 text-right">Invoice</th>
                <th className="px-3 py-2 text-right">Expenses</th><th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Commission</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{line.invoiceDate ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{line.invoiceDocNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[140px] truncate">{line.customerName ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{line.invoiceStatus ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(line.expensesAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmtRate(line.commissionRate)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {line.commissionAmount != null ? <span className={parseFloat(line.commissionAmount) < 0 ? "text-red-600" : "text-emerald-700"}>{fmt(line.commissionAmount)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[line.lineStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[line.lineStatus] ?? line.lineStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {(line.lineStatus === "needs_review" || line.lineStatus === "needs_configuration") && (
                        <Link href={`/commissions/review/${line.id}`} className="text-[10px] font-semibold text-blue-600 hover:underline whitespace-nowrap">Review →</Link>
                      )}
                    </td>
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
