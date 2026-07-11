import { eq } from "drizzle-orm";
import { db } from "./connection";
import { entitiesTable as entities } from "@workspace/db";

export type { EntityRow as Entity } from "@workspace/db";

/**
 * Resolve a slug to its Neon UUID.
 * Returns null when the entity is not seeded — callers must handle this case
 * and fall back rather than propagating a null UUID to other queries.
 */
export async function getEntityIdBySlug(slug: string): Promise<string | null> {
  const rows = await db
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
