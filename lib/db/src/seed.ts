/**
 * Seeds the entities table with the 4 FinanceOS companies.
 * QBO realm IDs are read from environment variables to keep credentials
 * out of source control. Set these before running:
 *
 *   QBO_REALM_CARDEALER_AI
 *   QBO_REALM_T3_MARKETING
 *   QBO_REALM_TOPMRKTR
 *   QBO_REALM_SMILE_MORE
 *
 * Run: pnpm --filter @workspace/db run seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { entities } from "./schema/entities";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running seed.");
}

const ENTITY_SEEDS = [
  {
    slug:             "CarDealer_ai",
    displayName:      "CarDealer.ai",
    shortName:        "CD.ai",
    qboRealmId:       process.env.QBO_REALM_CARDEALER_AI ?? "PLACEHOLDER_CARDEALER_AI",
    accountingBasis:  "Accrual",
    currency:         "USD",
    timeZone:         "America/Panama",
    status:           "active",
  },
  {
    slug:             "T3_Marketing",
    displayName:      "T3 Marketing",
    shortName:        "T3",
    qboRealmId:       process.env.QBO_REALM_T3_MARKETING ?? "PLACEHOLDER_T3_MARKETING",
    accountingBasis:  "Cash",
    currency:         "USD",
    timeZone:         "America/Panama",
    status:           "active",
  },
  {
    slug:             "TopMrktr",
    displayName:      "TopMrktr",
    shortName:        "TM",
    qboRealmId:       process.env.QBO_REALM_TOPMRKTR ?? "PLACEHOLDER_TOPMRKTR",
    accountingBasis:  "Accrual",
    currency:         "USD",
    timeZone:         "America/Panama",
    status:           "active",
  },
  {
    slug:             "Smile_More",
    displayName:      "Smile More",
    shortName:        "SM",
    qboRealmId:       process.env.QBO_REALM_SMILE_MORE ?? "PLACEHOLDER_SMILE_MORE",
    accountingBasis:  "Cash",
    currency:         "USD",
    timeZone:         "America/Panama",
    status:           "active",
  },
] as const;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("Seeding entities…");

for (const entity of ENTITY_SEEDS) {
  await db
    .insert(entities)
    .values(entity)
    .onConflictDoUpdate({
      target: entities.slug,
      set: {
        displayName:     sql`excluded.display_name`,
        shortName:       sql`excluded.short_name`,
        accountingBasis: sql`excluded.accounting_basis`,
        currency:        sql`excluded.currency`,
        timeZone:        sql`excluded.time_zone`,
        status:          sql`excluded.status`,
        updatedAt:       sql`now()`,
      },
    });
  console.log(`  ✓ ${entity.displayName}`);
}

console.log("Seed complete. Realm IDs can be updated once available in Replit Secrets.");
await pool.end();
