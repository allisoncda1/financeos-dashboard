import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Button } from "@/components/ui/button";
import { VERSIONS_DATA } from "@/lib/budgetModuleMockData";
import { History, Plus, Copy, BarChart2, CheckCircle2 } from "lucide-react";

export default function BudgetVersionsPage() {
  return (
    <BudgetLayout title="Budget Versions" subtitle="Track and compare budget versions over time">
      <div className="flex items-center justify-end mb-4">
        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 text-xs shadow-sm" data-testid="button-create-version">
          <Plus className="w-3.5 h-3.5" /> Create Version
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap" data-testid="table-budget-versions">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Version Name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fiscal Year</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Created By</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Last Updated</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {VERSIONS_DATA.map((version) => (
                <tr key={version.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <History className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <span className="font-semibold text-[12px] text-gray-900">{version.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 font-medium">{version.fy}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700">{version.createdBy}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700">{version.lastUpdated}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      version.status === 'Current' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                      version.status === 'Approved' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                      version.status === 'Draft' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                      'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                      {version.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-emerald-600" title="Compare">
                        <BarChart2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-emerald-600" title="Duplicate">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {version.status !== 'Current' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-emerald-600" title="Set as Current">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
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
