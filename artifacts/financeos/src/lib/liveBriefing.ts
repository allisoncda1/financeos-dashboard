// FinanceOS — adapts the live /api/briefing response (deterministic AI CFO
// briefing engine, Sprint 13) into the existing BriefingData / PriorityItem
// shapes so the existing AI Briefing panel and Today's Priorities widget can
// render live data without any layout or styling changes.

import type { BriefingResponse, Priority, Risk } from "./types";
import { ENTITY_REGISTRY, type EntitySlug } from "./entities";
import type { BriefingData, BriefingSummaryItem, PriorityItem, RecommendedAction } from "./briefing";

function resolveEntitySlug(entityName: string): EntitySlug | null {
  const match = ENTITY_REGISTRY.find((e) => e.displayName === entityName);
  return match ? match.slug : null;
}

function resolveEntityColor(entityName: string): string {
  const slug = resolveEntitySlug(entityName);
  if (!slug) return "#6B7280"; // portfolio-level / unmatched entity
  return ENTITY_REGISTRY.find((e) => e.slug === slug)?.primaryColor ?? "#6B7280";
}

function inferPriorityType(title: string): PriorityItem["type"] {
  const t = title.toLowerCase();
  if (t.includes("receivable") || t.includes(" ar ") || t.includes("collect")) return "ar";
  if (t.includes("payable") || t.includes(" ap ") || t.includes("overdue payables")) return "ap";
  if (t.includes("validation")) return "validation";
  if (t.includes("reconcil")) return "reconciliation";
  return "close";
}

/** Splits the backend's combined "Good morning — Weekday, Month Day, Year" greeting into two lines. */
export function splitGreeting(greeting: string): { greeting: string; date: string } {
  const parts = greeting.split(" — ");
  if (parts.length === 2) return { greeting: parts[0], date: parts[1] };
  return { greeting, date: "" };
}

export function mapHighlightsToSummaryItems(live: BriefingResponse): BriefingSummaryItem[] {
  return live.highlights.map((h) => ({ text: h.text, type: h.sentiment }));
}

export function mapPrioritiesToActions(live: BriefingResponse): RecommendedAction[] {
  return live.priorities.slice(0, 3).map((p, i) => ({
    index: i + 1,
    text: p.recommendedAction,
    href: (() => {
      const slug = resolveEntitySlug(p.entity);
      return slug ? `/entity/${slug}` : "/operations";
    })(),
  }));
}

export function adaptLiveBriefing(live: BriefingResponse, userName: string): BriefingData {
  const { greeting, date } = splitGreeting(live.greeting);
  return {
    greeting,
    userName,
    date,
    summaryItems: mapHighlightsToSummaryItems(live).slice(0, 5),
    recommendedActions: mapPrioritiesToActions(live),
    pipelineHealthy: live.risks.every((r) => r.severity !== "high"),
    lastUpdated: live.generatedAt.slice(0, 10),
    confidenceScore: live.confidenceScore,
  };
}

/**
 * Merges live priorities + risks into a single, severity-sorted list for the
 * existing Today's Priorities widget — surfacing risk conditions (DSO,
 * overdue AR/AP, low cash, low margin, validation) alongside recommended
 * actions without introducing a new UI section.
 */
export function adaptLivePriorities(live: BriefingResponse): PriorityItem[] {
  const fromPriorities: PriorityItem[] = live.priorities.map((p: Priority, i) => {
    const slug = resolveEntitySlug(p.entity);
    return {
      id: `live-priority-${i}-${p.title.replace(/\s+/g, "-").toLowerCase()}`,
      severity: p.severity,
      title: p.title,
      description: p.description,
      entity: p.entity,
      entitySlug: slug,
      entityColor: resolveEntityColor(p.entity),
      action: p.recommendedAction,
      href: slug ? `/entity/${slug}` : "/operations",
      type: inferPriorityType(p.title),
    };
  });

  const priorityTitles = new Set(live.priorities.map((p) => p.title));
  const fromRisks: PriorityItem[] = live.risks
    .filter((r: Risk) => !priorityTitles.has(r.title))
    .map((r, i) => {
      const slug = resolveEntitySlug(r.entity);
      return {
        id: `live-risk-${i}-${r.title.replace(/\s+/g, "-").toLowerCase()}`,
        severity: r.severity,
        title: r.title,
        description: r.description,
        entity: r.entity,
        entitySlug: slug,
        entityColor: resolveEntityColor(r.entity),
        action: "Investigate",
        href: slug ? `/entity/${slug}` : "/operations",
        type: inferPriorityType(r.title),
      };
    });

  const merged = [...fromPriorities, ...fromRisks];
  const order = { high: 0, medium: 1, low: 2 };
  merged.sort((a, b) => order[a.severity] - order[b.severity]);
  return merged.slice(0, 8);
}
