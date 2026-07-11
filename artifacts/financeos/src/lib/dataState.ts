// Data reliability — shared types + a tiny external store that lets every
// data-fetching hook "report" its current source so a single global
// DataSourceBanner can reflect whatever hooks are actually mounted on the
// current page, without every page having to render its own banner.

export type ApiSource = "db" | "live" | "cache" | "mock";
export type DataSourceState = ApiSource | "loading" | "unavailable";

export type FetchState<T> = {
  data: T | null;
  source: DataSourceState;
  lastSuccessfulFetch: string | null;
  /** Manually re-runs the fetch (same endpoint, no side effects). */
  refetch?: () => Promise<void>;
};

/**
 * VITE_USE_MOCK=true (development only) allows hooks to initialize
 * synchronously from bundled mock/sample data with a clear "mock" indicator,
 * instead of starting at "loading". Never enabled in production builds.
 */
export const USE_MOCK_FALLBACK: boolean = import.meta.env.VITE_USE_MOCK === "true";

/** VITE_DEV_MODE=true shows a small dev badge instead of alarming banners. */
export const DEV_MODE: boolean = import.meta.env.VITE_DEV_MODE === "true" || import.meta.env.DEV === true;

type Entry = { source: DataSourceState; lastSuccessfulFetch: string | null };

const registry = new Map<string, Entry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function reportDataSource(key: string, entry: Entry): void {
  registry.set(key, entry);
  notify();
}

export function clearDataSource(key: string): void {
  registry.delete(key);
  notify();
}

export function subscribeDataSource(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SEVERITY: Record<DataSourceState, number> = {
  unavailable: 4,
  mock: 3,
  cache: 2,
  loading: 1,
  live: 0,
  // "db" = served directly from the primary datastore (Neon Core). It is the
  // most trustworthy source, so it never triggers a degraded-source banner.
  db: 0,
};

type Snapshot = { source: DataSourceState; lastSuccessfulFetch: string | null };

let cachedSnapshot: Snapshot = { source: "loading", lastSuccessfulFetch: null };

/**
 * Snapshot combining every currently-registered hook, worst-first.
 * Returns a cached/stable reference when nothing has changed since the
 * last call — required by useSyncExternalStore, otherwise a fresh object
 * on every render triggers "getSnapshot should be cached" infinite loops.
 */
export function getDataSourceSnapshot(): Snapshot {
  let worst: DataSourceState = "live";
  let lastSuccessfulFetch: string | null = null;
  let any = false;

  for (const entry of registry.values()) {
    any = true;
    if (SEVERITY[entry.source] > SEVERITY[worst]) worst = entry.source;
    if (entry.lastSuccessfulFetch) {
      if (!lastSuccessfulFetch || entry.lastSuccessfulFetch > lastSuccessfulFetch) {
        lastSuccessfulFetch = entry.lastSuccessfulFetch;
      }
    }
  }

  if (!any) worst = "loading";

  if (cachedSnapshot.source !== worst || cachedSnapshot.lastSuccessfulFetch !== lastSuccessfulFetch) {
    cachedSnapshot = { source: worst, lastSuccessfulFetch };
  }
  return cachedSnapshot;
}
