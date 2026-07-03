/**
 * AI Platform — in-memory response cache.
 *
 * Caches AIResponse objects for 15 minutes, keyed by capability + a hash of
 * the relevant context fields. Prevents redundant provider calls (and, once
 * a real LLM is wired up, redundant token spend) for identical requests
 * made in quick succession.
 */

import type { AIResponse } from "./types";

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
  response: AIResponse;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

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

export function getCacheStats(): { size: number; hits: number; misses: number } {
  return { size: store.size, hits, misses };
}

export function invalidateCache(): void {
  store.clear();
  hits = 0;
  misses = 0;
}
