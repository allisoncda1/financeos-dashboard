import { useMemo } from "react";
import { SparklineChart } from "@/components/shared/SparklineChart";
import { useAllEntityFinancials } from "@/hooks/useApi";
import { ENTITY_SLUGS } from "@/lib/entities";
import { formatCurrency, formatPercent } from "@/lib/format";

function pctChange(data: number[]): number {
  const first = data[0];
  const last  = data[data.length - 1];
  return first === 0 ? 0 : ((last - first) / first) * 100;
}

const fmt = (n: number) => formatCurrency(n);

type TrendCardProps = {
  label: string;
  value: string;
  data: number[];
  color: string;
  period: string;
};

function TrendCard({ label, value, data, color, period }: TrendCardProps) {
  const pct = pctChange(data);
  const positive = pct >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <span className={`text-[10px] font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}>
          {formatPercent(pct, { signed: true })}
        </span>
      </div>
      <p className="text-[20px] font-bold text-gray-900 mb-3">{value}</p>
      <SparklineChart data={data} color={color} height={44} />
      <p className="text-[9px] text-gray-300 mt-1.5">{period}</p>
    </div>
  );
}

export function PortfolioTrends() {
  const { data: allFins } = useAllEntityFinancials();

  const { months, revenue, grossProfit, netIncome } = useMemo(() => {
    if (!allFins) return { months: [] as string[], revenue: [] as number[], grossProfit: [] as number[], netIncome: [] as number[] };
    const set = new Set<string>();
    for (const slug of ENTITY_SLUGS) for (const p of allFins[slug].monthly_pl) set.add(p.month);
    const monthLabels = [...set].sort();
    const byMonth: Record<string, Map<string, (typeof allFins)[keyof typeof allFins]["monthly_pl"][number]>> = {};
    for (const slug of ENTITY_SLUGS) {
      byMonth[slug] = new Map(allFins[slug].monthly_pl.map(p => [p.month, p]));
    }
    const sumAt = (key: "revenue" | "gross_profit" | "net_income") =>
      monthLabels.map(label =>
        ENTITY_SLUGS.reduce((s, slug) => s + (byMonth[slug].get(label)?.[key] ?? 0), 0)
      );
    return {
      months: monthLabels,
      revenue: sumAt("revenue"),
      grossProfit: sumAt("gross_profit"),
      netIncome: sumAt("net_income"),
    };
  }, [allFins]);

  if (months.length === 0) return null;

  const period = `${months[0]} – ${months[months.length - 1]} · all entities`;

  return (
    <div className="grid grid-cols-3 gap-4">
      <TrendCard
        label="Revenue Trend"
        value={fmt(revenue[revenue.length - 1])}
        data={revenue}
        color="#10B981"
        period={period}
      />
      <TrendCard
        label="Gross Profit Trend"
        value={fmt(grossProfit[grossProfit.length - 1])}
        data={grossProfit}
        color="#3B82F6"
        period={period}
      />
      <TrendCard
        label="Net Income Trend"
        value={fmt(netIncome[netIncome.length - 1])}
        data={netIncome}
        color="#8B5CF6"
        period={period}
      />
    </div>
  );
}
