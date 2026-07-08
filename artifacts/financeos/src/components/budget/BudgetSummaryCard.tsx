import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ListTree, Lightbulb, Clock } from "lucide-react";

export function BudgetSummaryCard() {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Budget Summary</h3>
            <p className="text-sm text-slate-500">FY2026 (Jul 2026 - Jun 2027)</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 rounded-md">Version: Current</Badge>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center text-sm">
            <Clock className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <div>
              <span className="text-slate-500 block">Last Updated</span>
              <span className="font-medium text-slate-900">Jul 7, 2026 by Allison Fabbri</span>
            </div>
          </div>
          <div className="flex items-center text-sm">
            <Users className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <div>
              <span className="text-slate-500 block">Departments</span>
              <span className="font-medium text-slate-900">6</span>
            </div>
          </div>
          <div className="flex items-center text-sm">
            <ListTree className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <div>
              <span className="text-slate-500 block">Budget Lines</span>
              <span className="font-medium text-slate-900">142</span>
            </div>
          </div>
          <div className="flex items-center text-sm">
            <Lightbulb className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <div>
              <span className="text-slate-500 block">Assumptions</span>
              <span className="font-medium text-slate-900">18</span>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full text-sm font-medium">
          View Assumptions
        </Button>
      </CardContent>
    </Card>
  );
}
