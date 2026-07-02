import {
  DollarSign, TrendingUp, Landmark, Receipt, Clock, Activity,
} from "lucide-react";
import { KpiCard, type KpiCardData } from "@/components/dashboard/KpiCard";
import type { DashboardData } from "@/lib/types";
import { ENTITY_SLUGS } from "@/lib/types";
import { computeHealthScore } from "@/lib/briefing";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function PortfolioKpiStrip({ data }: { data: DashboardData }) {
  const p = data.portfolio;

  const monthlyBurn = p.portfolio_opex_ytd / 6;
  const runway = monthlyBurn > 0 ? p.portfolio_cash_on_hand / monthlyBurn : 0;

  const scores = ENTITY_SLUGS.map((s) => computeHealthScore(data.metrics[s]));
  const avgHealth = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const cards: KpiCardData[] = [
    {
      label: "Revenue YTD",
      value: fmt(p.portfolio_revenue_ytd),
      delta: "+8.2%",
      positive: true,
      icon: TrendingUp,
      iconBg: "#10B981",
      compare: "vs prior period",
    },
    {
      label: "Net Income",
      value: fmt(p.portfolio_net_income_ytd),
      delta: "+12.4%",
      positive: true,
      icon: DollarSign,
      iconBg: "#3B82F6",
      compare: "vs prior period",
    },
    {
      label: "Cash on Hand",
      value: fmt(p.portfolio_cash_on_hand),
      delta: "+3.1%",
      positive: true,
      icon: Landmark,
      iconBg: "#6366F1",
      compare: "vs last month",
    },
    {
      label: "Open AR",
      value: fmt(p.portfolio_open_ar),
      delta: "+5.8%",
      positive: false,
      icon: Receipt,
      iconBg: "#F59E0B",
      compare: "vs last month",
    },
    {
      label: "Cash Runway",
      value: `${runway.toFixed(1)} mo`,
      delta: runway >= 6 ? "Healthy" : "Watch",
      positive: runway >= 6,
      icon: Clock,
      iconBg: "#8B5CF6",
      compare: "at current burn rate",
    },
    {
      label: "Health Score",
      value: `${avgHealth}/100`,
      delta: avgHealth >= 85 ? "Excellent" : avgHealth >= 70 ? "Good" : "Needs Attention",
      positive: avgHealth >= 70,
      icon: Activity,
      iconBg: "#059669",
      compare: "portfolio avg",
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-3">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}
