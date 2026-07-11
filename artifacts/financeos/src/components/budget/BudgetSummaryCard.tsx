import { Button } from "@/components/ui/button";
import { Calendar, Users, ListTree, Lightbulb, Clock } from "lucide-react";

export function BudgetSummaryCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">Budget Summary</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">FY2026 (Jul 2026 - Jun 2027)</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Version: Current</span>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-center">
            <Clock className="w-3.5 h-3.5 text-gray-400 mr-2.5 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block leading-tight">Last Updated</span>
              <span className="text-[12px] font-medium text-gray-900">Jul 7, 2026 by Allison Fabbri</span>
            </div>
          </div>
          <div className="flex items-center">
            <Users className="w-3.5 h-3.5 text-gray-400 mr-2.5 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block leading-tight">Departments</span>
              <span className="text-[12px] font-medium text-gray-900">6</span>
            </div>
          </div>
          <div className="flex items-center">
            <ListTree className="w-3.5 h-3.5 text-gray-400 mr-2.5 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block leading-tight">Budget Lines</span>
              <span className="text-[12px] font-medium text-gray-900">142</span>
            </div>
          </div>
          <div className="flex items-center">
            <Lightbulb className="w-3.5 h-3.5 text-gray-400 mr-2.5 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold block leading-tight">Assumptions</span>
              <span className="text-[12px] font-medium text-gray-900">18</span>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full text-xs h-8 text-gray-700">
          View Assumptions
        </Button>
      </div>
    </div>
  );
}
