/**
 * AI Platform — shared types.
 *
 * Every AI capability in FinanceOS flows through these contracts. The
 * frontend NEVER calls an LLM directly — it only ever talks to
 * routes/ai.ts, which builds an AIContext (structured, normalized data —
 * never raw CSV/Drive payloads) and hands it to whichever AIProvider is
 * configured via AI_PROVIDER.
 */

import type {
  Anomaly,
  DataFreshness,
  EntityMetrics,
  EntitySlug,
  PortfolioSummary,
  ValidationSummary,
} from "../lib/types";
import type { Alert } from "../rules/engine";

export type AICapability = "briefing" | "report-summary" | "financials-analysis" | "question" | "document-extraction";

export type AIOptions = {
  temperature?: number;
  maxTokens?: number;
  format?: "text" | "json";
};

/**
 * AIContext — the only data an AIProvider is ever allowed to see. Built by
 * ai/context.ts from normalized, typed FinanceOS data sources. Never
 * includes raw CSV rows or unparsed Google Drive file contents.
 */
export type AIContext = {
  portfolio: PortfolioSummary;
  entities: Record<EntitySlug, { metrics: EntityMetrics; anomalies: Anomaly[] }>;
  alerts: Alert[];
  validation: ValidationSummary;
  freshness: DataFreshness;
  period?: string;
  question?: string;
  reportSections?: Record<string, unknown>;
};

export type AIRequest = {
  capability: AICapability;
  context: AIContext;
  options?: AIOptions;
};

export type AIResponse = {
  content: string;
  structured?: unknown;
  provider: string;
  model: string;
  cachedAt?: string;
  generatedAt: string;
  tokensUsed?: number;
};

export type AIProviderStatus = {
  name: string;
  model: string;
  available: boolean;
  lastUsed: string | null;
  cacheHits: number;
  totalRequests: number;
};

/**
 * DocumentExtractionContext — the only data a provider sees for Commission
 * Document extraction. Deliberately NOT part of AIContext (which is
 * portfolio/briefing-shaped) — this is locally-extracted PDF text, always
 * untrusted DATA to extract facts from, never an instruction to follow.
 */
export type DocumentExtractionContext = {
  documentText: string;
  fileName: string;
};

/** Strict shape the model must return — one row per line item found on the document. */
export type ExtractedDocumentLine = {
  lineIndex: number;
  clientName: string | null;
  amount: string | null; // decimal string, e.g. "75.00" — never a number (avoids float coercion)
  description: string | null;
  proofPage: number | null;
  ambiguous: boolean;
};

export type DocumentExtractionResult = {
  vendorName: string | null;
  documentNumber: string | null;
  documentDate: string | null; // YYYY-MM-DD
  documentTotal: string | null;
  lines: ExtractedDocumentLine[];
};
