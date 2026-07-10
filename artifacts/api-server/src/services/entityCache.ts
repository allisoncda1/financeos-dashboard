/**
 * Entity slug → Neon UUID resolution cache.
 *
 * Entity IDs are immutable at runtime — they are written once when the
 * entity is seeded and never change. The cache is populated on the first
 * call and reused for the lifetime of the server process, eliminating
 * repeated getEntityIdBySlug DB queries from every transformer.
 *
 * Returns null when a slug is not seeded — callers must handle this and
 * fall through to Drive / mock rather than propagating a null UUID.
 */
import { EntitiesService } from "../db";

let cache: Map<string, string | null> | null = null;

async function warm(): Promise<Map<string, string | null>> {
  const all = await EntitiesService.getAllEntities();
  // Core stores slugs lower-cased; Dashboard EntitySlug values are mixed-case
  // (e.g. "CarDealer_ai"). Key the cache lower-cased so both resolve.
  return new Map(all.map((e) => [e.slug.toLowerCase(), e.id]));
}

export async function getCachedEntityId(slug: string): Promise<string | null> {
  if (!cache) cache = await warm();
  return cache.get(slug.toLowerCase()) ?? null;
}

/** Pre-warm the cache at server startup to avoid a latency spike on the first request. */
export async function warmEntityCache(): Promise<void> {
  if (!cache) cache = await warm();
}
