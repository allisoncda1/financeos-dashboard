import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { CommissionRunLine } from "@/lib/api";
import { useCommissionEntity } from "@/lib/commission-context";
import { formatCurrency } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  house_no_commission: "bg-gray-100 text-gray-600",
  needs_configuration: "bg-amber-100 text-amber-800",
  needs_review:        "bg-red-100 text-red-800",
  calculated:          "bg-emerald-100 text-emerald-800",
  approved:            "bg-green-100 text-green-800",
  locked:              "bg-slate-100 text-slate-700",
};
const STATUS_LABEL: Record<string, string> = {
  house_no_commission: "House",
  needs_configuration: "Needs Config",
  needs_review:        "Needs Review",
  calculated:          "Calculated",
  approved:            "Approved",
  locked:              "Locked",
};

function fmt(v: string | number | null | undefined) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : formatCurrency(n);
}

export function CommissionStatusTable() {
  const { activeSlug } = useCommissionEntity();
  const [lines, setLines] = useState<CommissionRunLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    api.commissionLines(activeSlug, { limit: 200 }).then((res) => {
      if (mounted.current) {
        setLines(res.data ?? []);
        setTotal(res.total ?? 0);
        setLoading(false);
      }
    }).catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [activeSlug]);

  if (loading) {
    return <p className="px-5 py-10 text-sm text-gray-400 text-center">Loading…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center text-gray-400 text-sm">
        <p>No commission lines for this entity.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Invoice Lines</h2>
        <span className="text-xs text-gray-400">{total} lines</span>
      </div>
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
              <th className="px-4 py-2.5 font-medium text-right">Commission</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2 text-gray-500">{line.invoiceDate ?? "—"}</td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{line.invoiceDocNumber ?? "—"}</td>
                <td className="px-4 py-2 font-medium text-gray-900 max-w-[180px] truncate">{line.customerName ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">
                  {line.representativeDisplayName ?? <span className="text-red-400 italic text-xs">Unattributed</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-[11px] font-medium ${
                    line.invoiceStatus === "Paid"    ? "text-emerald-700" :
                    line.invoiceStatus === "Overdue" ? "text-red-600"     : "text-gray-500"
                  }`}>{line.invoiceStatus ?? "—"}</span>
                </td>
                <td className="px-4 py-2 text-right text-gray-700">{fmt(line.invoiceAmount)}</td>
                <td className="px-4 py-2 text-right font-semibold">
                  {line.lineStatus === "house_no_commission"
                    ? <span className="text-gray-400">$0.00</span>
                    : line.commissionAmount != null
                      ? <span className="text-emerald-700">{fmt(line.commissionAmount)}</span>
                      : <span className="text-amber-400 italic text-xs">
                          {line.exclusionReason === "missing_commission_formula" ? "No rule" : "—"}
                        </span>
                  }
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_TONE[line.lineStatus] ?? "bg-gray-100 text-gray-500"}`}>
                    {STATUS_LABEL[line.lineStatus] ?? line.lineStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
