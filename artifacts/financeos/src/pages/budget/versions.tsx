import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VERSIONS_DATA } from "@/lib/budgetModuleMockData";
import { History, Plus, Copy, BarChart2, CheckCircle2 } from "lucide-react";

export default function BudgetVersionsPage() {
  return (
    <BudgetLayout title="Budget Versions" subtitle="Track and compare budget versions over time">
      <div className="flex items-center justify-end mb-4">
        <Button className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="button-create-version">
          <Plus className="w-4 h-4" /> Create Version
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap" data-testid="table-budget-versions">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Version Name</th>
                  <th className="px-4 py-4 font-medium">Fiscal Year</th>
                  <th className="px-4 py-4 font-medium">Created By</th>
                  <th className="px-4 py-4 font-medium">Last Updated</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {VERSIONS_DATA.map((version) => (
                  <tr key={version.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <History className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="font-semibold text-slate-900">{version.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-medium">{version.fy}</td>
                    <td className="px-4 py-4 text-slate-600">{version.createdBy}</td>
                    <td className="px-4 py-4 text-slate-600">{version.lastUpdated}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        version.status === 'Current' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        version.status === 'Approved' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        version.status === 'Draft' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        {version.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600" title="Compare">
                          <BarChart2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600" title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </Button>
                        {version.status !== 'Current' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-emerald-600" title="Set as Current">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
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
