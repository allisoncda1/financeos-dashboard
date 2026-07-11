import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Button } from "@/components/ui/button";
import { REPORTS_DATA } from "@/lib/budgetModuleMockData";
import { FileText, Download, FileSpreadsheet, Eye } from "lucide-react";

export default function BudgetReportsPage() {
  return (
    <BudgetLayout title="Reports" subtitle="Budget reports and exports">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {REPORTS_DATA.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col" data-testid={`card-report-${report.id}`}>
            <div className="p-4 flex-1 flex flex-col">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">{report.title}</h3>
              <p className="text-[12px] text-gray-500 mb-5 flex-1">{report.description}</p>
              
              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5 text-gray-600" data-testid={`btn-view-${report.id}`}>
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5 text-gray-600" data-testid={`btn-pdf-${report.id}`}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-[11px] gap-1.5 text-gray-600" data-testid={`btn-excel-${report.id}`}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </BudgetLayout>
  );
}
