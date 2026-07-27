import { AlertCircle } from "lucide-react";

export function RecentActivityCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-start gap-4" data-testid="budget-recent-activity-unavailable">
      <AlertCircle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-gray-900">Recent activity not available</p>
        <p className="text-[12px] text-gray-500 mt-1">
          Budget activity feed requires operational event tracking. Not yet available.
        </p>
      </div>
    </div>
  );
}
