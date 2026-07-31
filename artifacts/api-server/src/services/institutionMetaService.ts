/**
 * institutionMetaService.ts — Plaid institution metadata with server-side TTL cache.
 *
 * Fetches logo (base64 PNG) and primary color for a given institution_id via
 * Plaid's /institutions/get_by_id with include_optional_metadata=true.
 *
 * SECURITY:
 *  - The raw base64 logo string is never logged.
 *  - Only well-formed #RRGGBB primary colors are exposed; others coerce to null.
 *  - Only Plaid-returned base64 data is accepted; no external URLs.
 *
 * AVAILABILITY:
 *  - A Plaid failure caches a null result and returns gracefully — never throws.
 *
 * CACHING:
 *  - Results are cached in-process for CACHE_TTL_MS (6 h), keyed by institution_id.
 *  - Both successful and failed lookups are cached to prevent repeated Plaid calls.
 */

import { CountryCode } from "plaid";
import { plaidClient } from "../lib/plaidClient.js";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface InstitutionMeta {
  logoDataUri: string | null;   // data:image/png;base64,... or null
  primaryColor: string | null;  // validated #RRGGBB or null
  cachedAt: number;
}

// Module-level TTL cache — shared across requests within the same process.
const _cache = new Map<string, InstitutionMeta>();

/** Exposed only for test isolation — must never be called in production code. */
export function _clearCacheForTest(): void {
  _cache.clear();
}

export async function fetchInstitutionMeta(
  institutionId: string,
): Promise<InstitutionMeta> {
  const now = Date.now();
  const hit = _cache.get(institutionId);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) return hit;

  let meta: InstitutionMeta;
  try {
    const res = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: { include_optional_metadata: true },
    });
    const inst = res.data.institution;

    // Only accept Plaid's returned base64 string — never an external URL
    const rawLogo = inst.logo ?? null;
    const logoDataUri = rawLogo ? `data:image/png;base64,${rawLogo}` : null;

    const rawColor = inst.primary_color ?? null;
    const primaryColor =
      rawColor && HEX_COLOR_RE.test(rawColor) ? rawColor : null;

    meta = { logoDataUri, primaryColor, cachedAt: now };
  } catch {
    // Cache the null result so the next request within the TTL is fast
    meta = { logoDataUri: null, primaryColor: null, cachedAt: now };
  }

  _cache.set(institutionId, meta);
  return meta;
}
