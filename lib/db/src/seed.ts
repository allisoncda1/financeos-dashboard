import { sql } from "drizzle-orm";
import { db, pool, entitiesTable } from "./index";

const ENTITIES = [
  {
    slug: "cardealer_ai",
    displayName: "CarDealer.ai",
    accountingBasis: "Cash",
    currency: "USD",
    timeZone: "America/Panama",
    qboRealmId: process.env["QBO_REALM_CARDEALER_AI"] ?? "PLACEHOLDER_QBO_REALM_CARDEALER_AI",
  },
  {
    slug: "t3_marketing",
    displayName: "T3 Marketing",
    accountingBasis: "Cash",
    currency: "USD",
    timeZone: "America/Panama",
    qboRealmId: process.env["QBO_REALM_T3_MARKETING"] ?? "PLACEHOLDER_QBO_REALM_T3_MARKETING",
  },
  {
    slug: "topmrktr",
    displayName: "TopMrktr",
    accountingBasis: "Cash",
    currency: "USD",
    timeZone: "America/Panama",
    qboRealmId: process.env["QBO_REALM_TOPMRKTR"] ?? "PLACEHOLDER_QBO_REALM_TOPMRKTR",
  },
  {
    slug: "smile_more",
    displayName: "Smile More",
    accountingBasis: "Cash",
    currency: "USD",
    timeZone: "America/Panama",
    qboRealmId: process.env["QBO_REALM_SMILE_MORE"] ?? "PLACEHOLDER_QBO_REALM_SMILE_MORE",
  },
];

async function seed() {
  for (const entity of ENTITIES) {
    await db
      .insert(entitiesTable)
      .values(entity)
      .onConflictDoUpdate({
        target: entitiesTable.slug,
        set: {
          displayName: entity.displayName,
          accountingBasis: entity.accountingBasis,
          currency: entity.currency,
          timeZone: entity.timeZone,
          qboRealmId: entity.qboRealmId,
          updatedAt: sql`now()`,
        },
      });
    console.log(`Seeded entity: ${entity.slug}`);
  }
}

seed()
  .then(() => {
    console.log(`Done. Seeded ${ENTITIES.length} entities.`);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
