import { eq } from "drizzle-orm";
import { db, opsDb } from "./connection";
import { entitiesTable as entities } from "@workspace/db";

export type { EntityRow as Entity } from "@workspace/db";

/**
 * Resolve a slug to its Neon UUID.
 * Returns null when the entity is not seeded — callers must handle this case
 * and fall back rather than propagating a null UUID to other queries.
 *
 * Uses CORE_DATABASE_URL (read-only Neon). Do NOT call this from Plaid routes.
 */
export async function getEntityIdBySlug(slug: string): Promise<string | null> {
  const rows = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Resolve a slug to its heliumdb entity UUID using DATABASE_URL only.
 *
 * Safe to call from Plaid routes — never touches CORE_DATABASE_URL.
 * Returns null if the slug exists in the whitelist but has no matching row
 * in heliumdb (e.g. entity not yet seeded). Callers must treat null as an
 * error and return 503 rather than writing a NULL UUID to plaid_consent_records.
 */
export async function getEntityIdBySlugOps(slug: string): Promise<string | null> {
  const rows = await opsDb
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getAllEntities() {
  return db
    .select()
    .from(entities)
    .orderBy(entities.displayName);
}
