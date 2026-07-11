import { COMMISSION_BY_REP } from "@/lib/commissionMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link } from "wouter";

const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CommissionRepChart() {
  const total = COMMISSION_BY_REP.reduce((s, r) => s + r.earned, 0);

  return (
    <Card
      title="Commission by Sales Rep (Jun 2026)"
      action={
        <Link href="/commissions/sales-reps" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700" data-testid="link-view-all-reps">
          View all reps
        </Link>
      }
    >
      <div className="p-4 flex flex-col items-center">
        <div className="relative" style={{ width: 190, height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={COMMISSION_BY_REP}
                dataKey="earned"
                nameKey="name"
                innerRadius={62}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
              >
                {COMMISSION_BY_REP.map(r => <Cell key={r.name} fill={r.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[18px] font-bold text-gray-900">{fmt(total)}</p>
            <p className="text-[10px] text-gray-400">Total Earned</p>
          </div>
        </div>

        <table className="w-full mt-4">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="pb-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales Rep</th>
              <th className="pb-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Earned</th>
              <th className="pb-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {COMMISSION_BY_REP.map(r => (
              <tr key={r.name} data-testid={`row-rep-${r.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <td className="py-2 text-[12px] text-gray-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  {r.name}
                </td>
                <td className="py-2 text-right text-[12px] font-semibold text-gray-900">{fmt(r.earned)}</td>
                <td className="py-2 text-right text-[12px] text-gray-500">{r.pct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200">
              <td className="py-2 text-[12px] font-bold text-gray-900">Total</td>
              <td className="py-2 text-right text-[12px] font-bold text-gray-900">{fmt(total)}</td>
              <td className="py-2 text-right text-[12px] font-bold text-gray-900">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
