import { FileText } from "lucide-react";
import { Link } from "wouter";

export default function BudgetReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Budget Reports</h1>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
        <FileText className="w-10 h-10 text-white/20 mx-auto" />
        <p className="text-white/60 font-medium">Budget reporting is available in the Report Center</p>
        <p className="text-white/30 text-sm max-w-sm mx-auto">
          Use the Report Center to generate P&amp;L and portfolio reports. Budget-specific report templates are coming in V2.
        </p>
        <Link href="/reports">
          <a className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
            Go to Report Center
          </a>
        </Link>
      </div>
    </div>
  );
}
