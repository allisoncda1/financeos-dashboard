import { Card, CardContent } from "@/components/ui/card";
import { SparklineChart } from "@/components/shared/SparklineChart";
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

  const sparklineData =
    type === "revenue" ? [12, 14, 13, 16, 15, 17] :
    type === "expense" ? [10, 11, 10, 12, 11, 14] :
    type === "income" ? [2, 3, 3, 4, 4, 3] :
    type === "margin" ? [60, 61, 62, 61, 62, 62.1] : [];

  const sparklineColor =
    type === "revenue" ? "#10B981" :
    type === "expense" ? "#F43F5E" :
    type === "income" ? "#3B82F6" :
    "#8B5CF6";

  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              type === "revenue" ? "bg-emerald-100 text-emerald-600" :
              type === "expense" ? "bg-rose-100 text-rose-600" :
              type === "income" ? "bg-blue-100 text-blue-600" :
              type === "margin" ? "bg-purple-100 text-purple-600" :
              "bg-slate-100 text-slate-600"
            }`}>
              {type === "revenue" || type === "expense" || type === "income" ? (
                <DollarSign className="w-4 h-4" />
              ) : type === "margin" ? (
                <Percent className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{value}</h3>
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-1.5 text-xs">
              {!isNeutral && (
                <span className={`flex items-center font-medium ${isPositiveChange ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositiveChange ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {change}
                </span>
              )}
              <span className="text-slate-500">{vs}</span>
            </div>
            {type === "completion" ? (
              <div className="mt-1">
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full" style={{ width: value }}></div>
                 </div>
              </div>
            ) : (
               <div className="mt-2 h-8 w-full opacity-60">
                 <SparklineChart data={sparklineData} color={sparklineColor} height={32} />
               </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
