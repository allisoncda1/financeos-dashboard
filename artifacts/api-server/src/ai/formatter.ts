/**
 * AI Platform — response formatters.
 *
 * Normalizes a provider-agnostic AIResponse into the shape each route's
 * consumer expects, regardless of whether the response came from
 * MockProvider's structured payload or a future LLM provider's raw text.
 */

import type { BriefingResponse, Severity } from "../lib/types";
import type { AIResponse } from "./types";

function isBriefingResponse(value: unknown): value is BriefingResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["greeting"] === "string" &&
    Array.isArray(v["executiveSummary"]) &&
    Array.isArray(v["highlights"]) &&
    Array.isArray(v["priorities"]) &&
    Array.isArray(v["risks"]) &&
    Array.isArray(v["opportunities"]) &&
    typeof v["confidenceScore"] === "number" &&
    typeof v["generatedAt"] === "string"
  );
}

function toSeverity(value: unknown): Severity {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (value === "critical") return "high";
  return "medium";
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Sanitizes an LLM-produced briefing so malformed items (missing titles,
 * out-of-vocabulary severities, string entries where objects are expected)
 * never reach the frontend. Deterministic MockProvider output passes
 * through unchanged.
 */
function sanitizeBriefing(b: BriefingResponse): BriefingResponse {
  return {
    ...b,
    executiveSummary: b.executiveSummary.filter((s): s is string => typeof s === "string" && s.length > 0),
    highlights: b.highlights
      .filter((h) => h && typeof h === "object" && str((h as { text?: unknown }).text).length > 0)
      .map((h) => ({
        icon: str(h.icon) || "minus",
        text: str(h.text),
        sentiment: h.sentiment === "positive" || h.sentiment === "negative" ? h.sentiment : "neutral",
      })),
    priorities: b.priorities
      .filter((p) => p && typeof p === "object" && str((p as { title?: unknown }).title).length > 0)
      .map((p) => ({
        title: str(p.title),
        description: str(p.description),
        severity: toSeverity(p.severity),
        entity: str(p.entity),
        recommendedAction: str(p.recommendedAction) || "Investigate",
        status: "New" as const,
      })),
    risks: b.risks
      .filter((r) => r && typeof r === "object" && str((r as { title?: unknown }).title).length > 0)
      .map((r) => ({
        title: str(r.title),
        description: str(r.description),
        severity: toSeverity(r.severity),
        entity: str(r.entity),
      })),
    opportunities: b.opportunities
      .filter((o) => o && typeof o === "object" && str((o as { title?: unknown }).title).length > 0)
      .map((o) => ({
        title: str(o.title),
        description: str(o.description),
        entity: str(o.entity),
      })),
    confidenceScore: Math.max(0, Math.min(100, Number(b.confidenceScore) || 0)),
  };
}

export function formatBriefingResponse(response: AIResponse): BriefingResponse {
  if (isBriefingResponse(response.structured)) {
    return sanitizeBriefing(response.structured);
  }

  return {
    greeting: "Good day",
    executiveSummary: [response.content],
    highlights: [],
    priorities: [],
    risks: [],
    opportunities: [],
    confidenceScore: 0,
    generatedAt: response.generatedAt,
  };
}

export function formatAnalysisResponse(response: AIResponse): { bullets: string[]; summary: string } {
  const structured = response.structured as { bullets?: unknown } | undefined;
  if (structured && Array.isArray(structured.bullets)) {
    return {
      bullets: structured.bullets as string[],
      summary: response.content,
    };
  }

  const bullets = response.content
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter((line) => line.length > 0);

  return { bullets, summary: response.content };
}
