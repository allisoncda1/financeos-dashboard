import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import {
  useDashboardData,
  useEntityFinancials,
  useEntityBanking,
  useAlerts,
  usePipelineStatus,
} from "@/hooks/useApi";
import { ENTITY_CONFIG, ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import {
  TrendingUp, DollarSign, Briefcase, Building2, Timer,
} from "lucide-react";

import { EntityHeader }   from "@/components/dashboard/EntityHeader";
import { KpiCard }        from "@/components/dashboard/KpiCard";
import { ProfitChart }    from "@/components/dashboard/ProfitChart";
import { CompanyHealth }  from "@/components/dashboard/CompanyHealth";
import { TopMetrics }     from "@/components/dashboard/TopMetrics";
import { BankAccounts }   from "@/components/dashboard/BankAccounts";
import { RecentAlerts }   from "@/components/dashboard/RecentAlerts";
import { CashFlowChart }  from "@/components/dashboard/CashFlowChart";
import { SystemStatus }   from "@/components/dashboard/SystemStatus";
import { computeCompanyHealth } from "@/lib/healthScore";
import type { DataSourceState } from "@/lib/dataState";
import { formatCurrency, DASH } from "@/lib/format";


export default function EntityPage() {
  const { slug } = useParams<{ slug: string }>();
  const eSlug = slug as EntitySlug;

  // All hooks run unconditionally (before any early return) to keep hook order
  // stable. Each surfaces its own {data, source}; none fabricate values.
  const { data, source } = useDashboardData();
  const financials = useEntityFinancials(eSlug);
  const banking    = useEntityBanking(eSlug);
  const alertsState = useAlerts();
  const pipeline   = usePipelineStatus();

  if (!slug || !ENTITY_SLUGS.includes(eSlug)) return <NotFound />;
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const config   = ENTITY_CONFIG[eSlug];
  const m        = data.metrics[eSlug];

  // ── Real, entity-scoped alerts (Core `alerts` table via /api/alerts) ───────
  const entityAlerts = alertsState.data
    ? alertsState.data.filter(
        (a) => a.entitySlug === eSlug.toLowerCase() || a.entity === config.name,
      )
    : null;

  // ── Derived values (only from real data; otherwise null → "—") ─────────────
  const monthlyPL       = financials.data?.monthly_pl ?? null;
  const monthsElapsed   = monthlyPL && monthlyPL.length > 0 ? monthlyPL.length : null;
  const monthlyBurn     = monthsElapsed ? m.opex_ytd / monthsElapsed : null;
  const runway          = monthlyBurn && monthlyBurn > 0 && m.cash_on_hand > 0
    ? m.cash_on_hand / monthlyBurn
    : null;
  const totalExpenses   = m.cogs_ytd + m.opex_ytd;

  // ── Company Health Score — deterministic, real-data-only (lib/healthScore) ──
  const health = computeCompanyHealth({
    metrics: m,
    monthlyPL,
    validation: {
      passed: data.validation.passed ?? null,
      totalChecks: data.validation.total_checks ?? null,
    },
  });

  // Effective source across every feed whose data is displayed on this page.
  // Includes `source` (from /api/model) because KPI values, Top Metrics and the
  // Data Integrity score are all derived from it — excluding it would let the
  // pill claim "Live DB" while those prominent numbers are actually cached.
  const realSources: DataSourceState[] = [source, financials.source, banking.source, alertsState.source, pipeline.source];
  const pageSource: DataSourceState =
    realSources.includes("mock") ? "mock"
    : realSources.includes("unavailable") ? "unavailable"
    : realSources.includes("cache") ? "cache"
    : realSources.every((s) => s === "db") ? "db"
    : realSources.includes("loading") ? "loading"
    : "live";

  const fmt = (n: number) => formatCurrency(n);

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
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 max-w-[1400px] w-full mx-auto">

        {/* Row 1 — 5 KPI cards. Deltas omitted: no comparable prior period
            is published yet, so a neutral "—" is shown instead of a fake trend. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <KpiCard
            label="NET PROFIT"
            value={fmt(m.net_income_ytd)}
            icon={TrendingUp}
            iconBg="#10B981"
          />
          <KpiCard
            label="REVENUE"
            value={fmt(m.revenue_ytd)}
            icon={DollarSign}
            iconBg="#3B82F6"
          />
          <KpiCard
            label="EXPENSES"
            value={fmt(totalExpenses)}
            icon={Briefcase}
            iconBg="#8B5CF6"
          />
          <KpiCard
            label="CASH BALANCE"
            value={fmt(m.cash_on_hand)}
            icon={Building2}
            iconBg="#0EA5E9"
          />
          <KpiCard
            label="RUNWAY"
            value={runway === null ? DASH : `${runway.toFixed(1)} Months`}
            icon={Timer}
            iconBg="#F97316"
          />
        </div>

        {/* Row 2 — 3-column grid (stacks on smaller screens) */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_220px_260px]">

          {/* Column 1: Chart + Alerts */}
          <div className="flex flex-col gap-4">
            <ProfitChart data={monthlyPL} />
            <RecentAlerts alerts={entityAlerts} />
          </div>

          {/* Column 2: Company Health + Cash Flow */}
          <div className="flex flex-col gap-4">
            <CompanyHealth health={health} score={m.health_score} label={m.health_label} />
            <CashFlowChart data={financials.data?.cash_flow ?? null} />
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
            <BankAccounts banking={banking.data} />
          </div>
        </div>

        {/* System Status — audit/technical info moved out of prime space */}
        <SystemStatus
          validation={{
            passed: data.validation.passed ?? null,
            totalChecks: data.validation.total_checks ?? null,
            allPassed: data.validation.all_passed ?? null,
          }}
          pipeline={pipeline.data}
          basis={m.basis}
          asOf={m.as_of}
          pipelineRun={m.pipeline_run}
          source={pageSource}
        />
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}
