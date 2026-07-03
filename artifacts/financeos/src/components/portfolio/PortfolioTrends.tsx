import { SparklineChart } from "@/components/shared/SparklineChart";

// 12-month mock trend data (Jul'25 – Jun'26)
const REVENUE_DATA = [95200, 108400, 112000, 98700, 115600, 122300, 118900, 131200, 119800, 126500, 138200, 156400];
const CASH_DATA    = [520000, 534000, 548000, 541000, 559000, 572000, 565000, 588000, 601000, 614000, 628000, 739800];
const INCOME_DATA  = [22100, 26400, 28800, 21300, 31200, 33700, 29800, 36500, 31200, 34800, 40100, 43600];

function pctChange(data: number[]): number {
  const first = data[0];
  const last  = data[data.length - 1];
  return first === 0 ? 0 : ((last - first) / first) * 100;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

type TrendCardProps = {
  label: string;
  value: string;
  data: number[];
  color: string;
};

function TrendCard({ label, value, data, color }: TrendCardProps) {
  const pct = pctChange(data);
  const positive = pct >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-medium text-gray-500">{label}</p>
        <span className={`text-[10px] font-semibold ${positive ? "text-emerald-600" : "text-red-500"}`}>
          {positive ? "+" : ""}{pct.toFixed(1)}% 12M
        </span>
      </div>
      <p className="text-[20px] font-bold text-gray-900 mb-3">{value}</p>
      <SparklineChart data={data} color={color} height={44} />
      <p className="text-[9px] text-gray-300 mt-1.5">Jul 2025 – Jun 2026</p>
    </div>
  );
}

export function PortfolioTrends() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <TrendCard
        label="Revenue Trend"
        value={fmt(REVENUE_DATA[REVENUE_DATA.length - 1])}
        data={REVENUE_DATA}
        color="#10B981"
      />
      <TrendCard
        label="Cash Trend"
        value={fmt(CASH_DATA[CASH_DATA.length - 1])}
        data={CASH_DATA}
        color="#3B82F6"
      />
      <TrendCard
        label="Net Income Trend"
        value={fmt(INCOME_DATA[INCOME_DATA.length - 1])}
        data={INCOME_DATA}
        color="#8B5CF6"
      />
    </div>
  );
}
