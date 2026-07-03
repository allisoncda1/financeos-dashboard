/**
 * AI Platform — response formatters.
 *
 * Normalizes a provider-agnostic AIResponse into the shape each route's
 * consumer expects, regardless of whether the response came from
 * MockProvider's structured payload or a future LLM provider's raw text.
 */

import type { BriefingResponse } from "../lib/types";
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

export function formatBriefingResponse(response: AIResponse): BriefingResponse {
  if (isBriefingResponse(response.structured)) {
    return response.structured;
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
