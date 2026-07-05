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
import { HealthScore }    from "@/components/dashboard/HealthScore";
import { TopMetrics }     from "@/components/dashboard/TopMetrics";
import { BankAccounts }   from "@/components/dashboard/BankAccounts";
import { RecentAlerts }   from "@/components/dashboard/RecentAlerts";
import { CashFlowChart }  from "@/components/dashboard/CashFlowChart";
import type { DataSourceState } from "@/lib/dataState";


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

  function fmt(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toLocaleString()}`;
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

        {/* Row 1 — 5 KPI cards. Deltas omitted: no comparable prior period
            is published yet, so a neutral "—" is shown instead of a fake trend. */}
        <div className="grid grid-cols-5 gap-4">
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
            value={runway === null ? "—" : `${runway.toFixed(1)} Months`}
            icon={Timer}
            iconBg="#F97316"
          />
        </div>

        {/* Row 2 — 3-column grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 220px 260px" }}>

          {/* Column 1: Chart + Alerts */}
          <div className="flex flex-col gap-4">
            <ProfitChart data={monthlyPL} />
            <RecentAlerts alerts={entityAlerts} />
          </div>

          {/* Column 2: Data Integrity + Cash Flow */}
          <div className="flex flex-col gap-4">
            <HealthScore
              passed={data.validation.passed ?? null}
              totalChecks={data.validation.total_checks ?? null}
              allPassed={data.validation.all_passed ?? null}
            />
            <CashFlowChart />
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

        {/* Pipeline status footer — bound to real validation + pipeline data */}
        <div className="flex items-center gap-6 px-1 py-2">
          <StatusDot
            label={
              data.validation.total_checks != null
                ? `${data.validation.passed}/${data.validation.total_checks} Validation`
                : "Validation: not reported"
            }
            ok={!!data.validation.all_passed}
          />
          <StatusDot
            label={`Model Build: ${pipeline.data?.modelBuild ?? data.freshness.model_build ?? "unknown"}`}
            ok={(pipeline.data?.modelBuild ?? data.freshness.model_build) === "complete"
              || (pipeline.data?.modelBuild ?? data.freshness.model_build) === "success"}
          />
          <StatusDot
            label={`Pipeline: ${pipeline.data?.staleStatus ?? "unknown"}`}
            ok={pipeline.data?.staleStatus === "fresh"}
          />
          <StatusDot label={`Data Freshness: ${m.as_of}`} ok={pipeline.data?.staleStatus !== "red"} />
          <SourcePill source={pageSource} />
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

function SourcePill({ source }: { source: DataSourceState }) {
  const cfg: Record<DataSourceState, { text: string; cls: string }> = {
    db:          { text: "Source: Live DB", cls: "bg-emerald-100 text-emerald-700" },
    live:        { text: "Source: Live",    cls: "bg-emerald-100 text-emerald-700" },
    cache:       { text: "Source: Cached",  cls: "bg-blue-100 text-blue-700" },
    mock:        { text: "Source: Sample",  cls: "bg-amber-100 text-amber-800" },
    loading:     { text: "Source: …",       cls: "bg-gray-100 text-gray-500" },
    unavailable: { text: "Source: Unavailable", cls: "bg-red-100 text-red-700" },
  };
  const c = cfg[source];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>
      {c.text}
    </span>
  );
}

export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}
