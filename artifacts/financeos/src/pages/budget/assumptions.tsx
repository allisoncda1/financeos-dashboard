import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Button } from "@/components/ui/button";
import { ASSUMPTIONS_DATA } from "@/lib/budgetModuleMockData";
import { Lightbulb, Plus } from "lucide-react";

export default function BudgetAssumptionsPage() {
  return (
    <BudgetLayout title="Assumptions" subtitle="Document the assumptions behind your budget">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-gray-500">Track key drivers and variables for FY2026</p>
        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 text-xs shadow-sm" data-testid="button-add-assumption">
          <Plus className="w-3.5 h-3.5" /> Add Assumption
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap" data-testid="table-budget-assumptions">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Assumption</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Value</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Owner</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Confidence</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ASSUMPTIONS_DATA.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <span className="font-semibold text-[12px] text-gray-900">{item.assumption}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-900 font-medium">{item.value}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700">{item.category}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700">{item.owner}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      item.confidence === 'High' ? 'bg-emerald-50 text-emerald-700' :
                      item.confidence === 'Medium' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {item.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-500 truncate max-w-[200px]" title={item.notes}>
                    {item.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BudgetLayout>
  );
}
