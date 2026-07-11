import { COMMISSION_BY_PLAN } from "@/lib/commissionMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CommissionPlanCard() {
  const totalReps = COMMISSION_BY_PLAN.reduce((s, p) => s + p.reps, 0);
  const totalEarned = COMMISSION_BY_PLAN.reduce((s, p) => s + p.earned, 0);

  return (
    <Card title="Commission by Plan (Jun 2026)">
      <div className="px-5 py-2">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Plan Name</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales Reps</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Earned</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {COMMISSION_BY_PLAN.map(p => (
              <tr key={p.id} data-testid={`row-plan-${p.id}`}>
                <td className="py-2.5 text-[12px] font-medium text-gray-800">{p.name}</td>
                <td className="py-2.5 text-right text-[12px] text-gray-500">{p.reps}</td>
                <td className="py-2.5 text-right text-[12px] font-semibold text-gray-900">{fmt(p.earned)}</td>
                <td className="py-2.5 text-right text-[12px] text-gray-500">{p.pct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200">
              <td className="py-2.5 text-[12px] font-bold text-gray-900">Total</td>
              <td className="py-2.5 text-right text-[12px] font-bold text-gray-900">{totalReps}</td>
              <td className="py-2.5 text-right text-[12px] font-bold text-gray-900">{fmt(totalEarned)}</td>
              <td className="py-2.5 text-right text-[12px] font-bold text-gray-900">100%</td>
            </tr>
          </tbody>
        </table>
        <Link
          href="/commissions/plans"
          data-testid="link-view-all-plans"
          className="flex items-center justify-between py-3 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View all plans <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
}
