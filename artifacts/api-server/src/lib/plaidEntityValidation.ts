/**
 * plaidEntityValidation.ts — Server-side entity slug whitelist validator.
 *
 * Validates entity slugs against the authoritative ENTITY_SLUGS constant.
 * Never trusts browser-supplied entity values.
 * Uses the operational heliumdb only — never the core analytics database.
 */

import { ENTITY_SLUGS } from "./types.js";

// Map from lowercase → canonical slug for case-insensitive lookup
const SLUG_MAP: ReadonlyMap<string, string> = new Map(
  ENTITY_SLUGS.map((s) => [s.toLowerCase(), s]),
);

/**
 * Validates that slug is a known entity slug (case-insensitive).
 * Returns the canonical-cased slug on success.
 * Throws with status 400 on invalid input.
 */
export function validateEntitySlug(slug: unknown): string {
  if (typeof slug !== "string" || slug.trim() === "") {
    throw Object.assign(new Error("entitySlug is required"), { status: 400 });
  }
  const normalized = slug.trim().toLowerCase();
  const canonical = SLUG_MAP.get(normalized);
  if (!canonical) {
    throw Object.assign(
      new Error(`Unknown entity: ${slug}`),
      { status: 400 },
    );
  }
  return canonical;
}
