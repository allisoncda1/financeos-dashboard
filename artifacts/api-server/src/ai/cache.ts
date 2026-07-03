/**
 * AI Platform — in-memory response cache, request deduplication, and usage
 * tracking.
 *
 * Caches AIResponse objects for 15 minutes, keyed by capability + a hash of
 * the relevant context fields. Prevents redundant provider calls (and,
 * with a real LLM wired up, redundant token spend) for identical requests
 * made in quick succession. Also deduplicates concurrent in-flight requests
 * for the same key, and tracks usage/cost estimates for the /api/ai/usage
 * endpoint.
 */

import type { AICapability, AIResponse } from "./types";

const CACHE_TTL_MS = 15 * 60 * 1000;

// Approximate Claude Sonnet input token rate — good enough for a rough
// estimate, not for billing purposes.
const ESTIMATED_COST_PER_TOKEN_USD = 0.000003;

type CacheEntry = {
  response: AIResponse;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

// Request deduplication: if a request for a given key is already in-flight,
// subsequent callers await the same promise instead of firing a new
// provider call.
const inFlight = new Map<string, Promise<AIResponse>>();

export function getCached(key: string): AIResponse | null {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    misses++;
    return null;
  }
  hits++;
  return entry.response;
}

export function setCached(key: string, response: AIResponse): void {
  store.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * withDedupe — ensures only one concurrent provider call happens per key.
 * If a request for `key` is already in flight, returns that same promise
 * rather than invoking `fn` again.
 */
export function withDedupe(key: string, fn: () => Promise<AIResponse>): Promise<AIResponse> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function invalidateCache(): void {
  store.clear();
  hits = 0;
  misses = 0;
}

// --- Usage tracking -------------------------------------------------------

let totalRequests = 0;
let totalTokensUsed = 0;
let dailyRequests = 0;
let dailyTokensUsed = 0;
const requestsByCapability: Record<AICapability, number> = {
  briefing: 0,
  "report-summary": 0,
  "financials-analysis": 0,
  question: 0,
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

let lastResetDate = todayUtc();

function resetDailyCountersIfNeeded(): void {
  const today = todayUtc();
  if (today !== lastResetDate) {
    lastResetDate = today;
    dailyRequests = 0;
    dailyTokensUsed = 0;
  }
}

export function recordUsage(capability: AICapability, tokensUsed: number): void {
  resetDailyCountersIfNeeded();

  totalRequests++;
  totalTokensUsed += tokensUsed;
  requestsByCapability[capability] = (requestsByCapability[capability] ?? 0) + 1;

  dailyRequests++;
  dailyTokensUsed += tokensUsed;
}

export function getUsageStats(): {
  totalRequests: number;
  totalTokensUsed: number;
  dailyRequests: number;
  dailyTokensUsed: number;
  estimatedDailyCostUsd: number;
  requestsByCapability: Record<AICapability, number>;
  resetDate: string;
} {
  resetDailyCountersIfNeeded();

  return {
    totalRequests,
    totalTokensUsed,
    dailyRequests,
    dailyTokensUsed,
    estimatedDailyCostUsd: dailyTokensUsed * ESTIMATED_COST_PER_TOKEN_USD,
    requestsByCapability: { ...requestsByCapability },
    resetDate: lastResetDate,
  };
}

export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  totalRequests: number;
  totalTokensUsed: number;
  requestsByCapability: Record<AICapability, number>;
  dailyRequests: number;
  dailyTokensUsed: number;
  estimatedDailyCostUsd: number;
} {
  resetDailyCountersIfNeeded();

  return {
    size: store.size,
    hits,
    misses,
    totalRequests,
    totalTokensUsed,
    requestsByCapability: { ...requestsByCapability },
    dailyRequests,
    dailyTokensUsed,
    estimatedDailyCostUsd: dailyTokensUsed * ESTIMATED_COST_PER_TOKEN_USD,
  };
}
