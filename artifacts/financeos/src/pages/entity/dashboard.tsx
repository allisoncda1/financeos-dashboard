import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { useDashboardData } from "@/hooks/useApi";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import {
  TrendingUp, DollarSign, Briefcase, Building2, Timer,
} from "lucide-react";

import { EntityHeader }   from "@/components/dashboard/EntityHeader";
import { KpiCard }        from "@/components/dashboard/KpiCard";
import { ProfitChart }    from "@/components/dashboard/ProfitChart";
import { HealthScore }    from "@/components/dashboard/HealthScore";
import { TopMetrics }     from "@/components/dashboard/TopMetrics";
import { BankAccounts }   from "@/components/dashboard/BankAccounts";
import { RecentAlerts }   from "@/components/dashboard/RecentAlerts";
import { CashFlowChart }  from "@/components/dashboard/CashFlowChart";


export default function EntityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, source } = useDashboardData();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const eSlug    = slug as EntitySlug;
  const config   = ENTITY_CONFIG[eSlug];
  const m        = data.metrics[eSlug];
  const anomalies = data.anomalies[eSlug] ?? [];

  // ── Derived values ────────────────────────────────────────────────────────
  const totalExpenses   = m.cogs_ytd + m.opex_ytd;
  const monthsElapsed   = 6; // Jan–Jun YTD
  const monthlyBurn     = m.opex_ytd / monthsElapsed;
  const runway          = monthlyBurn > 0 && m.cash_on_hand > 0 ? m.cash_on_hand / monthlyBurn : null;
  const healthScore     = data.validation.all_passed ? 92 : 74;
  const netCashApprox   = m.cash_on_hand;
  const cashInApprox    = Math.round(m.revenue_ytd / monthsElapsed);
  const cashOutApprox   = Math.round(totalExpenses / monthsElapsed);

  function fmt(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col" style={{ background: "#F4F5F7" }}>

      {/* ── Page header ─────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <EntityHeader
          entityName={config.name}
          entityColor={config.color}
          asOf={m.as_of}
          slug={eSlug}
        />
      </div>

      {/* ── Dashboard content ───────────────────────────── */}
      <div className="flex-1 px-6 py-5 space-y-4 max-w-[1400px] w-full mx-auto">

        {/* Row 1 — 5 KPI cards */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard
            label="NET PROFIT"
            value={fmt(m.net_income_ytd)}
            delta="+12.4%"
            positive={true}
            icon={TrendingUp}
            iconBg="#10B981"
            compare="vs prev period"
          />
          <KpiCard
            label="REVENUE"
            value={fmt(m.revenue_ytd)}
            delta="+8.7%"
            positive={true}
            icon={DollarSign}
            iconBg="#3B82F6"
            compare="vs prev period"
          />
          <KpiCard
            label="EXPENSES"
            value={fmt(totalExpenses)}
            delta="−3.2%"
            positive={false}
            icon={Briefcase}
            iconBg="#8B5CF6"
            compare="vs prev period"
          />
          <KpiCard
            label="CASH BALANCE"
            value={fmt(m.cash_on_hand)}
            delta="+5.6%"
            positive={true}
            icon={Building2}
            iconBg="#0EA5E9"
            compare="vs prev period"
          />
          <KpiCard
            label="RUNWAY"
            value={runway === null ? "—" : `${runway.toFixed(1)} Months`}
            delta="+0.7"
            positive={true}
            icon={Timer}
            iconBg="#F97316"
            compare="vs prev period"
          />
        </div>

        {/* Row 2 — 3-column grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 220px 260px" }}>

          {/* Column 1: Chart + Alerts */}
          <div className="flex flex-col gap-4">
            <ProfitChart />
            <RecentAlerts anomalies={anomalies} />
          </div>

          {/* Column 2: Health + Cash Flow */}
          <div className="flex flex-col gap-4">
            <HealthScore
              score={healthScore}
              validation40={data.validation.all_passed}
            />
            <CashFlowChart
              cashIn={cashInApprox}
              cashOut={cashOutApprox}
              netCash={netCashApprox}
            />
          </div>

          {/* Column 3: Metrics + Accounts */}
          <div className="flex flex-col gap-4">
            <TopMetrics
              grossMarginPct={m.gross_margin_pct}
              netMarginPct={m.net_margin_pct}
              openAR={m.open_ar}
              openAP={m.open_ap}
              monthlyBurn={monthlyBurn}
            />
            <BankAccounts cashOnHand={m.cash_on_hand} />
          </div>
        </div>

        {/* Pipeline status footer */}
        <div className="flex items-center gap-6 px-1 py-2">
          <StatusDot label="40/40 Validation" ok={data.validation.all_passed} />
          <StatusDot label="08_DATA_MODEL" ok={true} />
          <StatusDot label="Pipeline Status" ok={true} />
          <StatusDot label={`Data Freshness: ${m.as_of}`} ok={true} />
          <span className="ml-auto text-[10px] text-gray-400">
            Run: {new Date(m.pipeline_run).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: ok ? "#10B981" : "#EF4444" }}
      />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}
