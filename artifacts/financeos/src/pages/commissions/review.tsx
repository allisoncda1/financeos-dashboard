import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { parsePeriod, useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRunLine } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import Link from "@/lib/next-compat";

function fmt(v: string | null | undefined) {
  if (v == null) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : formatCurrency(n);
}

export default function CommissionReviewPage() {
  const { activeSlug, activePeriod } = useCommissionEntity();
  const periodParams = parsePeriod(activePeriod);
  const [lines, setLines] = useState<CommissionRunLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.commissionLines(activeSlug, { lineStatus: "needs_review", limit: 500, ...periodParams }),
      api.commissionLines(activeSlug, { lineStatus: "needs_configuration", limit: 500, ...periodParams }),
    ])
      .then(([r, c]) => {
        if (!mounted.current) return;
        const rd = Array.isArray(r) ? (r as CommissionRunLine[]) : ((r as { data?: CommissionRunLine[] }).data ?? []);
        const cd = Array.isArray(c) ? (c as CommissionRunLine[]) : ((c as { data?: CommissionRunLine[] }).data ?? []);
        setLines(
          [...rd, ...cd]
            .filter(line => line.representativeId != null)
            .sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? ""))
        );
        setLoading(false);
      })
      .catch(e => { if (mounted.current) { setError(String(e)); setLoading(false); } });
    return () => { mounted.current = false; };
  }, [activeSlug, activePeriod]);

  return (
    <CommissionLayout title="Commission Review" subtitle="Live external-rep lines requiring manual review or expense entry">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Lines Requiring Action</h2>
          <span className="text-xs text-gray-400">{loading ? "…" : `${lines.length} line${lines.length !== 1 ? "s" : ""}`}</span>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
          : lines.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">
              <p className="font-medium">No lines need review.</p>
              <p className="text-xs mt-1">All external-rep invoices are calculated or approved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Rep</th>
                    <th className="px-4 py-2 font-medium text-right">Invoice</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => (
                    <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{line.invoiceDate ?? "—"}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{line.customerName ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{line.representativeDisplayName ?? "Unattributed"}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${line.lineStatus === "needs_review" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                          {line.lineStatus === "needs_review" ? "Needs Review" : "Needs Config"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/commissions/review/${line.id}`} className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">
                          Review →
                        </Link>
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
