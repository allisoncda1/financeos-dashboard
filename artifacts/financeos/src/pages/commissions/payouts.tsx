import { useState, useEffect, useRef } from "react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { useCommissionEntity } from "@/lib/commission-context";
import { api } from "@/lib/api";
import type { CommissionRunLine } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

function fmt(v: string | null | undefined) { if (v == null) return "—"; const n = parseFloat(v); return isNaN(n) ? "—" : formatCurrency(n); }
function sumLines(ls: CommissionRunLine[]) { return ls.reduce((a, l) => { const n = parseFloat(l.commissionAmount ?? "0"); return a + (isNaN(n) ? 0 : n); }, 0); }

export default function CommissionPayoutsPage() {
  const { activeSlug } = useCommissionEntity();
  const [lines, setLines] = useState<CommissionRunLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    Promise.all([
      api.commissionLines(activeSlug, { lineStatus: "approved", limit: 500 }),
      api.commissionLines(activeSlug, { lineStatus: "locked",   limit: 500 }),
    ])
      .then(([a, l]) => {
        if (!mounted.current) return;
        const ad = Array.isArray(a) ? (a as CommissionRunLine[]) : ((a as { data?: CommissionRunLine[] }).data ?? []);
        const ld = Array.isArray(l) ? (l as CommissionRunLine[]) : ((l as { data?: CommissionRunLine[] }).data ?? []);
        setLines([...ad, ...ld].filter(x => x.payoutEligible));
        setLoading(false);
      })
      .catch(e => { if (mounted.current) { setError(String(e)); setLoading(false); } });
    return () => { mounted.current = false; };
  }, [activeSlug]);

  const byRep = new Map<string, { repName: string; lines: CommissionRunLine[] }>();
  for (const line of lines) {
    const k = line.representativeId ?? "unattributed";
    if (!byRep.has(k)) byRep.set(k, { repName: line.representativeDisplayName ?? "Unattributed", lines: [] });
    byRep.get(k)!.lines.push(line);
  }
  const groups = [...byRep.entries()].sort(([,a],[,b]) => a.repName.localeCompare(b.repName));
  const grandTotal = sumLines(lines);

  return (
    <CommissionLayout title="Payouts" subtitle="Approved and locked external-rep commission lines">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
      {!loading && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total Approved Payout</p>
            <p className="text-2xl font-bold text-emerald-900 mt-0.5">{formatCurrency(grandTotal)}</p>
          </div>
          <p className="text-xs text-emerald-700">{lines.length} line{lines.length !== 1 ? "s" : ""} across {groups.length} rep{groups.length !== 1 ? "s" : ""}</p>
        </div>
      )}
      {loading ? <p className="text-sm text-gray-400 py-8">Loading…</p>
        : groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center text-gray-400 text-sm">
            <p className="font-medium">No approved payouts yet.</p>
            <p className="text-xs mt-1">Approve commission lines in Review to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([repId, { repName, lines: repLines }]) => (
              <div key={repId} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div><h3 className="text-sm font-semibold text-gray-900">{repName}</h3><p className="text-xs text-gray-400">{repLines.length} line{repLines.length !== 1 ? "s" : ""}</p></div>
                  <span className="text-base font-bold text-emerald-700">{formatCurrency(sumLines(repLines))}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead><tr className="border-b border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium text-right">Invoice</th><th className="px-4 py-2 font-medium text-right">Expenses</th>
                      <th className="px-4 py-2 font-medium text-right">Commission</th><th className="px-4 py-2 font-medium">Status</th>
                    </tr></thead>
                    <tbody>
                      {repLines.map(line => (
                        <tr key={line.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{line.invoiceDate ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-800 max-w-[200px] truncate">{line.customerName ?? "—"}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{fmt(line.expensesAmount)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-700">{fmt(line.commissionAmount)}</td>
                          <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${line.lineStatus === "locked" ? "bg-slate-100 text-slate-700" : "bg-green-100 text-green-800"}`}>{line.lineStatus === "locked" ? "Locked" : "Approved"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
    </CommissionLayout>
  );
}
