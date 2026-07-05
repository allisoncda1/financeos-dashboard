
import {
  DollarSign, TrendingUp, Landmark, Receipt, Clock, Activity,
} from "lucide-react";
import { KpiCard, type KpiCardData } from "@/components/dashboard/KpiCard";
import { StaggerContainer, StaggerItem, MotionCard } from "@/components/motion";
import type { DashboardData } from "@/lib/types";
import { ENTITY_SLUGS } from "@/lib/entities";
import { computeHealthScore } from "@/lib/briefing";
import { formatCurrency } from "@/lib/format";

const fmt = (n: number | null | undefined) => formatCurrency(n);

export function PortfolioKpiStrip({ data }: { data: DashboardData }) {
  const p = data.portfolio;

  const opexYtd = typeof p.portfolio_opex_ytd === "number" ? p.portfolio_opex_ytd : 0;
  const cashOnHand = typeof p.portfolio_cash_on_hand === "number" ? p.portfolio_cash_on_hand : 0;
  const monthlyBurn = opexYtd / 6;
  const runway = monthlyBurn > 0 ? cashOnHand / monthlyBurn : 0;

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
    <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3" stagger={0.05}>
      {cards.map((card) => (
        <StaggerItem key={card.label}>
          <MotionCard className="h-full">
            <KpiCard {...card} />
          </MotionCard>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
