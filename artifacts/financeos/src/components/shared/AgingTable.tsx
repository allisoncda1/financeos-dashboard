import type { AgingBucket } from "@/lib/types";

type Props = {
  buckets: AgingBucket[];
  total: number;
  label: "AR" | "AP";
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

const BAR_COLORS = ["#10B981", "#F59E0B", "#F97316", "#EF4444", "#991B1B"];

export function AgingTable({ buckets, total, label }: Props) {
  const overdueAmt = buckets.slice(2).reduce((s, b) => s + b.amount, 0);
  const overduePct = total > 0 ? (overdueAmt / total) * 100 : 0;

  // The aging buckets must reconcile to the authoritative total. When they
  // don't (Core published a headline balance but no per-bucket detail), we
  // keep the authoritative total and say the breakdown is unavailable rather
  // than render misleading all-$0 buckets.
  const bucketSum = buckets.reduce((s, b) => s + b.amount, 0);
  const reconciles = Math.abs(bucketSum - total) <= 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">{label} Aging</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-500">
            Total: <span className="font-semibold text-gray-800">{fmt(total)}</span>
          </span>
          {reconciles && overdueAmt > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
              {fmt(overdueAmt)} overdue ({overduePct.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>

      {!reconciles ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] font-medium text-gray-500">Aging detail unavailable</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Open {label} of {fmt(total)} is shown from the authoritative source; a per-bucket aging breakdown was not provided.
          </p>
        </div>
      ) : (
      <>
      {/* Stacked bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex rounded-full overflow-hidden h-2">
          {buckets.map((b, i) =>
            b.amount > 0 ? (
              <div
                key={b.label}
                style={{ width: `${(b.amount / total) * 100}%`, background: BAR_COLORS[i] }}
                title={`${b.label}: ${fmt(b.amount)}`}
              />
            ) : null
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {buckets.map((b, i) => (
            <div key={b.label} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: BAR_COLORS[i] }}
              />
              <span className="text-[9px] text-gray-400">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-t border-gray-100">
            <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bucket</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Count</th>
            <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const pct = total > 0 ? (b.amount / total) * 100 : 0;
            const isOverdue = i >= 2;
            return (
              <tr key={b.label} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: BAR_COLORS[i] }}
                    />
                    <span className={`text-[12px] font-medium ${isOverdue && b.amount > 0 ? "text-red-700" : "text-gray-700"}`}>
                      {b.label}
                    </span>
                    {isOverdue && b.amount > 0 && (
                      <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">Overdue</span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${isOverdue && b.amount > 0 ? "text-red-700" : "text-gray-800"}`}>
                  {b.amount > 0 ? fmt(b.amount) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-[12px] text-gray-500">{b.count}</td>
                <td className="px-4 py-2.5 text-right text-[12px] text-gray-500">
                  {pct > 0 ? `${pct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="px-4 py-2.5 text-[12px] font-bold text-gray-900">Total</td>
            <td className="px-4 py-2.5 text-right text-[12px] font-bold text-gray-900">{fmt(total)}</td>
            <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-700">
              {buckets.reduce((s, b) => s + b.count, 0)}
            </td>
            <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-gray-700">100%</td>
          </tr>
        </tfoot>
      </table>
      </>
      )}
    </div>
  );
}
