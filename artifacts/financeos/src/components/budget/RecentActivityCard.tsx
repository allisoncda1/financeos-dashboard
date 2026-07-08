import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RECENT_ACTIVITY } from "@/lib/budgetMockData";
import { Activity } from "lucide-react";

export function RecentActivityCard() {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          Recent Activity
        </h3>

        <div className="space-y-4 mb-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-100">
          {RECENT_ACTIVITY.map((activity, i) => (
            <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-white bg-slate-200 group-[.is-active]:bg-emerald-500 text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2" />
              <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] ml-6 md:ml-0 p-3 rounded-lg border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-900 text-xs">{activity.action}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  <span>{activity.by}</span>
                  <span className="mx-1">•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="w-full text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
          View All Activity
        </Button>
      </CardContent>
    </Card>
  );
}
