import { useDashboardData, useBriefing, usePipelineStatus } from "@/hooks/useApi";
import { format } from "date-fns";
import { generateBriefing, generatePriorities } from "@/lib/briefing";
import { adaptLiveBriefing, adaptLivePriorities } from "@/lib/liveBriefing";
import { ENTITY_SLUGS } from "@/lib/entities";
import { AIBriefingPanel } from "@/components/portfolio/AIBriefingPanel";
import { PortfolioKpiStrip } from "@/components/portfolio/PortfolioKpiStrip";
import { TodaysPriorities } from "@/components/portfolio/TodaysPriorities";
import { EntityCard } from "@/components/portfolio/EntityCard";
import { PortfolioTrends } from "@/components/portfolio/PortfolioTrends";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/motion";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export default function PortfolioPage() {
  const { data, source, refetch: refetchDashboard } = useDashboardData();
  const live = useBriefing();
  const pipeline = usePipelineStatus();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refetchDashboard?.(),
        live.refetch?.(),
        pipeline.refetch?.(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const lastPipelineRun = pipeline.data?.lastPipelineRun
    ? (() => {
        const parsed = new Date(pipeline.data.lastPipelineRun);
        return Number.isNaN(parsed.getTime()) ? null : format(parsed, "MMM d, yyyy h:mm a");
      })()
    : null;
  const staleStatus = pipeline.data?.staleStatus ?? null;
  const staleDotClass =
    staleStatus === "fresh"
      ? "bg-emerald-500"
      : staleStatus === "amber"
      ? "bg-amber-500"
      : staleStatus === "red"
      ? "bg-red-500"
      : "bg-gray-300";
  const staleLabel =
    staleStatus === "red"
      ? "Data may be stale"
      : staleStatus
      ? null
      : "Status unknown";

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  // Deterministic AI CFO briefing (Sprint 13) — falls back to the local,
  // metrics-derived briefing if /api/briefing hasn't loaded yet or failed.
  const fallbackBriefing = generateBriefing(data);
  const fallbackPriorities = generatePriorities(data);
  const briefing = live.data ? adaptLiveBriefing(live.data, fallbackBriefing.userName) : fallbackBriefing;
  const priorities = live.data ? adaptLivePriorities(live.data) : fallbackPriorities;
  const executiveSummary = live.data?.executiveSummary ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── AI Briefing Panel (left rail) ── */}
      <AIBriefingPanel briefing={briefing} />

      {/* ── Main content (scrollable) ─────── */}
      <div className="flex-1 overflow-y-auto bg-[#F4F5F7]">
        <PageTransition>
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-bold text-gray-900">Portfolio Overview</h1>
              <p className="text-[12px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                <span>
                  4 entities · Data as of {lastPipelineRun ?? data.freshness.data_as_of}
                </span>
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${staleDotClass}`}
                  title={staleLabel ?? undefined}
                />
                {staleLabel && (
                  <span className="text-gray-400">{staleLabel}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-gray-600 font-medium">Pipeline healthy</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <kbd className="hidden md:flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-400 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Executive Summary (deterministic AI CFO briefing) */}
          {executiveSummary.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-1.5">
              {executiveSummary.map((paragraph, i) => (
                <p key={i} className="text-[12px] text-gray-600 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* KPI Strip */}
          <PortfolioKpiStrip data={data} />

          {/* Today's Priorities */}
          <TodaysPriorities priorities={priorities} />

          {/* Entity Cards 2×2 */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-700 mb-3">Entities</h2>
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4" stagger={0.07} delay={0.1}>
              {ENTITY_SLUGS.map((slug) => (
                <StaggerItem key={slug}>
                  <EntityCard
                    slug={slug}
                    metrics={data.metrics[slug]}
                    validationPassed={data.validation.all_passed}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>

          {/* Portfolio Trends */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-700 mb-3">Portfolio Trends</h2>
            <PortfolioTrends />
          </div>
        </div>
        </PageTransition>
      </div>
    </div>
  );
}
