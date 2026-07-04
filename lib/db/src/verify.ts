import { db, pool, entitiesTable } from "./index";

async function main() {
  const rows = await db.select().from(entitiesTable).orderBy(entitiesTable.slug);
  for (const row of rows) {
    console.log(`${row.slug}: ${row.qboRealmId}`);
  }
}

main()
  .catch((err) => {
    console.error("Verify failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
