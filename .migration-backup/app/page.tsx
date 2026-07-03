import { getMockData } from "@/lib/mock";
import { generateBriefing, generatePriorities } from "@/lib/briefing";
import { ENTITY_SLUGS } from "@/lib/entities";
import { AIBriefingPanel } from "@/components/portfolio/AIBriefingPanel";
import { PortfolioKpiStrip } from "@/components/portfolio/PortfolioKpiStrip";
import { TodaysPriorities } from "@/components/portfolio/TodaysPriorities";
import { EntityCard } from "@/components/portfolio/EntityCard";
import { PortfolioTrends } from "@/components/portfolio/PortfolioTrends";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/motion";
import { RefreshCw } from "lucide-react";

export default function PortfolioPage() {
  const data = getMockData();
  const briefing = generateBriefing(data);
  const priorities = generatePriorities(data);

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
              <p className="text-[12px] text-gray-500 mt-0.5">
                4 entities · Data as of {data.freshness.data_as_of}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-gray-600 font-medium">Pipeline healthy</span>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
              <kbd className="hidden md:flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-400 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

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
