import { Button } from "@/components/ui/button";
import { RECENT_ACTIVITY } from "@/lib/budgetMockData";
import { Activity } from "lucide-react";

export function RecentActivityCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <h3 className="text-[13px] font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          Recent Activity
        </h3>

        <div className="space-y-4 mb-5 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gray-100">
          {RECENT_ACTIVITY.map((activity, i) => (
            <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-4 h-4 rounded-full border-2 border-white bg-gray-200 group-[.is-active]:bg-emerald-500 text-gray-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2" />
              <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] ml-6 md:ml-0 p-2.5 rounded-lg border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-gray-900 text-[11px]">{activity.action}</span>
                </div>
                <div className="text-gray-500 text-[10px]">
                  <span>{activity.by}</span>
                  <span className="mx-1">•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="w-full text-xs h-8 font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
          View All Activity
        </Button>
      </div>
    </div>
  );
}
