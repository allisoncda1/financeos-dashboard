import type { ComponentType } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

type LucideIcon = ComponentType<{ className?: string }>;

interface Props {
  title: string;
  value: string;
  icon: LucideIcon;
  /** hex color for the icon circle */
  iconBg: string;
  change?: string; // "+4.2%" | "-1.8%" | ""
  vs?: string;
}

/** KPI card matching the Budget module's visual system (indigo module). */
export function AnalyticsKpiCard({ title, value, icon: Icon, iconBg, change = "", vs = "" }: Props) {
  const isPositive = change.startsWith("+");
  const isNeutral = !change;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 h-full">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{title}</p>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{value}</p>
        </div>
      </div>
      {!isNeutral ? (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{change}</span>
          <span className="text-gray-400 font-normal ml-1">{vs}</span>
        </div>
      ) : vs ? (
        <div className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-300">
          <span>—</span>
          <span className="text-gray-400 font-normal ml-1">{vs}</span>
        </div>
      ) : null}
    </div>
  );
}
