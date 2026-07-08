import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ASSUMPTIONS_DATA } from "@/lib/budgetModuleMockData";
import { Lightbulb, Plus } from "lucide-react";

export default function BudgetAssumptionsPage() {
  return (
    <BudgetLayout title="Assumptions" subtitle="Document the assumptions behind your budget">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Track key drivers and variables for FY2026</p>
        <Button className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="button-add-assumption">
          <Plus className="w-4 h-4" /> Add Assumption
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap" data-testid="table-budget-assumptions">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Assumption</th>
                  <th className="px-4 py-4 font-medium">Value</th>
                  <th className="px-4 py-4 font-medium">Category</th>
                  <th className="px-4 py-4 font-medium">Owner</th>
                  <th className="px-4 py-4 font-medium">Confidence</th>
                  <th className="px-6 py-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ASSUMPTIONS_DATA.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                          <Lightbulb className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="font-semibold text-slate-900">{item.assumption}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-medium">{item.value}</td>
                    <td className="px-4 py-4 text-slate-600">{item.category}</td>
                    <td className="px-4 py-4 text-slate-600">{item.owner}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.confidence === 'High' ? 'bg-emerald-100 text-emerald-800' :
                        item.confidence === 'Medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {item.confidence}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]" title={item.notes}>
                      {item.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </BudgetLayout>
  );
}
