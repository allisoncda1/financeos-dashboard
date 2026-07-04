import { useDashboardData, useAlerts } from "@/hooks/useApi";
import { alertsToOperationItems } from "@/lib/operations";
import { OperationsInbox } from "@/components/operations/OperationsInbox";
import { Inbox } from "lucide-react";

export default function OperationsPage() {
  const { data } = useDashboardData();
  const { data: alerts, loading } = useAlerts();

  const items = alertsToOperationItems(alerts);
  const asOfLabel = data?.freshness.data_as_of ?? "—";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Page header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Inbox className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Operations Inbox</h1>
            <p className="text-[11px] text-gray-400">
              {loading
                ? "Loading live alerts…"
                : `${items.length} item${items.length !== 1 ? "s" : ""} · Rules Engine · as of ${asOfLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-semibold rounded-full">
            {items.filter((i) => i.severity === "high").length} High
          </span>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-full">
            {items.filter((i) => i.severity === "medium").length} Medium
          </span>
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-full">
            {items.filter((i) => i.severity === "low").length} Low
          </span>
        </div>
      </div>

      {/* 3-column inbox */}
      <div className="flex-1 overflow-hidden">
        <OperationsInbox items={items} />
      </div>
    </div>
  );
}
