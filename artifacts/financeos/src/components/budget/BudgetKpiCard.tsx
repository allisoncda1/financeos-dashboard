import { TrendingUp, TrendingDown, DollarSign, Percent, CheckCircle } from "lucide-react";

interface Props {
  title: string;
  value: string;
  change: string;
  vs: string;
  type: "revenue" | "expense" | "income" | "margin" | "completion";
}

export function BudgetKpiCard({ title, value, change, vs, type }: Props) {
  const isPositiveChange = change.startsWith("+");
  const isNeutral = !change;

  const iconBg =
    type === "revenue" ? "#10B981" :
    type === "expense" ? "#EF4444" :
    type === "income" ? "#3B82F6" :
    type === "margin" ? "#8B5CF6" :
    "#64748B";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3 h-full">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          {type === "revenue" || type === "expense" || type === "income" ? (
            <DollarSign className="w-5 h-5 text-white" />
          ) : type === "margin" ? (
            <Percent className="w-5 h-5 text-white" />
          ) : (
            <CheckCircle className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{title}</p>
          <p className="text-[22px] font-bold text-gray-900 leading-tight">{value}</p>
        </div>
      </div>
      {!isNeutral ? (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${isPositiveChange ? "text-emerald-600" : "text-red-500"}`}>
          {isPositiveChange ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{change}</span>
          <span className="text-gray-400 font-normal ml-1">{vs}</span>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-300">
          <span>—</span>
          <span className="text-gray-400 font-normal ml-1">{vs}</span>
        </div>
      )}
    </div>
  );
}
