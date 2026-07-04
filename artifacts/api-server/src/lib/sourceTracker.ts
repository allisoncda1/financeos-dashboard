import { AsyncLocalStorage } from "async_hooks";

export type DataSourceKind = "live" | "cache" | "mock";

type Store = { sources: DataSourceKind[] };

const als = new AsyncLocalStorage<Store>();

const RECENT_LIMIT = 200;
const recent: DataSourceKind[] = [];

function recordSource(source: DataSourceKind): void {
  recent.push(source);
  if (recent.length > RECENT_LIMIT) recent.shift();
}

export function getSourceSummary(): {
  live: number;
  cache: number;
  mock: number;
  total: number;
} {
  const counts = { live: 0, cache: 0, mock: 0 };
  for (const s of recent) counts[s]++;
  return { ...counts, total: recent.length };
}

/** Combine multiple observed sources using worst-wins priority: mock > cache > live. */
export function combineSources(sources: DataSourceKind[]): DataSourceKind {
  if (sources.length === 0) return "live";
  if (sources.includes("mock")) return "mock";
  if (sources.includes("cache")) return "cache";
  return "live";
}

/**
 * Called by driveLoader (and anywhere else that resolves data) to report
 * which source satisfied the current call. Only has an effect inside a
 * `trackSource()` call — reports outside that context are silently dropped.
 */
export function reportSource(source: DataSourceKind): void {
  const store = als.getStore();
  if (store) store.sources.push(source);
}

/**
 * Wraps an async data-loading function, collecting every `reportSource()`
 * call made anywhere in its (possibly nested, cross-module) async call graph
 * via AsyncLocalStorage, and returns the combined result alongside the
 * data itself. Also records the outcome into the rolling summary used by
 * GET /api/pipeline/status.
 */
export async function trackSource<T>(
  fn: () => Promise<T>,
): Promise<{ data: T; source: DataSourceKind }> {
  const store: Store = { sources: [] };
  const data = await als.run(store, fn);
  const source = combineSources(store.sources);
  recordSource(source);
  return { data, source };
}
