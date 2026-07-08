import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REPORTS_DATA } from "@/lib/budgetModuleMockData";
import { FileText, Download, FileSpreadsheet, Eye } from "lucide-react";

export default function BudgetReportsPage() {
  return (
    <BudgetLayout title="Reports" subtitle="Budget reports and exports">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORTS_DATA.map((report) => (
          <Card key={report.id} className="shadow-sm border-slate-200 flex flex-col" data-testid={`card-report-${report.id}`}>
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{report.title}</h3>
              <p className="text-sm text-slate-500 mb-6 flex-1">{report.description}</p>
              
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" data-testid={`btn-view-${report.id}`}>
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" data-testid={`btn-pdf-${report.id}`}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" data-testid={`btn-excel-${report.id}`}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </BudgetLayout>
  );
}
