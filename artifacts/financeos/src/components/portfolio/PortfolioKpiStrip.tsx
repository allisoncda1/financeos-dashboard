
import {
  DollarSign, TrendingUp, Landmark, Receipt, Clock, Activity,
} from "lucide-react";
import { KpiCard, type KpiCardData } from "@/components/dashboard/KpiCard";
import { StaggerContainer, StaggerItem, MotionCard } from "@/components/motion";
import type { DashboardData } from "@/lib/types";
import { formatCurrency, DASH } from "@/lib/format";

const fmt = (n: number | null | undefined) => formatCurrency(n);

export function PortfolioKpiStrip({ data }: { data: DashboardData }) {
  const p = data.portfolio;

  // Cash runway comes from the server (computed date-aware in neonSource.ts /
  // services/kpi.ts). Null means no valid data; show "—" rather than a
  // fabricated number.
  const runway = p.cash_runway_months;
  const runwayLabel = runway !== null ? `${runway.toFixed(1)} mo` : DASH;

  // Portfolio health avg is computed server-side from the same penalty formula
  // used per entity. Null when insufficient data is available from any entity.
  const avgHealth = p.portfolio_health_score_avg;
  const healthLabel = avgHealth !== null
    ? `${avgHealth}/100`
    : DASH;
  const healthStatus = avgHealth !== null
    ? (avgHealth >= 85 ? "Excellent" : avgHealth >= 70 ? "Good" : "Needs Attention")
    : null;

  const cards: KpiCardData[] = [
    {
      label: "Revenue YTD",
      value: fmt(p.portfolio_revenue_ytd),
      icon: TrendingUp,
      iconBg: "#10B981",
      compare: "portfolio total",
    },
    {
      label: "Net Income",
      value: fmt(p.portfolio_net_income_ytd),
      icon: DollarSign,
      iconBg: "#3B82F6",
      compare: "portfolio total",
    },
    {
      label: "Cash on Hand",
      value: fmt(p.portfolio_cash_on_hand),
      icon: Landmark,
      iconBg: "#6366F1",
      compare: "portfolio total",
    },
    {
      label: "Open AR",
      value: fmt(p.portfolio_open_ar),
      icon: Receipt,
      iconBg: "#F59E0B",
      compare: "portfolio total",
    },
    {
      label: "Cash Runway",
      value: runwayLabel,
      delta: runway !== null ? (runway >= 6 ? "Healthy" : "Watch") : undefined,
      positive: runway !== null ? runway >= 6 : undefined,
      icon: Clock,
      iconBg: "#8B5CF6",
      compare: "at current burn rate",
    },
    {
      label: "Health Score",
      value: healthLabel,
      delta: healthStatus ?? undefined,
      positive: avgHealth !== null ? avgHealth >= 70 : undefined,
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
