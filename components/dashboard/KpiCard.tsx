import type { ComponentType } from "react";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";

type LucideIcon = ComponentType<{ className?: string }>;

export type KpiCardData = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: LucideIcon;
  iconBg: string;
  compare?: string;
};

export function KpiCard({ label, value, delta, positive, icon: Icon, iconBg, compare = "vs prev month" }: KpiCardData) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
            <Info className="w-3 h-3 text-gray-300 flex-shrink-0" />
          </div>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{value}</p>
        </div>
      </div>
      <div
        className={`flex items-center gap-0.5 text-[11px] font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}
      >
        {positive ? (
          <ArrowUpRight className="w-3.5 h-3.5" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5" />
        )}
        <span>{delta}</span>
        <span className="text-gray-400 font-normal ml-1">{compare}</span>
      </div>
    </div>
  );
}
