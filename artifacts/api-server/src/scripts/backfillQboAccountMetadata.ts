/**
 * DRY-RUN backfill of QBO account metadata columns introduced in plaid_005.
 * Run without flags for dry-run only.
 * Run with --apply to execute the UPDATE (wrapped in a transaction).
 *
 * Matches historical lines to Core COA ONLY by:
 *   String(account.qboId) === coa_account_id
 *
 * Updates ONLY:
 *   coa_account_fully_qualified_name
 *   coa_account_subtype
 *   coa_account_classification
 *
 * Never modifies: coa_account_id, coa_account_name, coa_account_type,
 * amounts, dates, match assignments, review_status, Plaid rows.
 */

import { Pool } from "pg";
import { getCachedEntityId } from "../services/entityCache.js";
import { getAllAccounts } from "../db/accounts.js";

const APPLY = process.argv.includes("--apply");
const DATABASE_URL = process.env["DATABASE_URL"];
const CORE_URL = process.env["CORE_DATABASE_URL"];

if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
if (DATABASE_URL === CORE_URL) {
  console.error("SAFETY: DATABASE_URL === CORE_DATABASE_URL — refusing to run");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

interface HistoricalRow {
  id: string;
  match_id: string;
  entity_slug: string;
  coa_account_id: string | null;
  coa_account_name: string | null;
  coa_account_fully_qualified_name: string | null;
  coa_account_subtype: string | null;
  coa_account_classification: string | null;
}

async function main() {
  const client = await pool.connect();
  try {
    // 1. Load all historical lines with entity_slug from match
    const { rows } = await client.query<HistoricalRow>(`
      SELECT
        l.id,
        l.match_id,
        m.entity_slug,
        l.coa_account_id,
        l.coa_account_name,
        l.coa_account_fully_qualified_name,
        l.coa_account_subtype,
        l.coa_account_classification
      FROM bank_transaction_qbo_lines l
      JOIN bank_transaction_qbo_matches m ON m.id = l.match_id
      ORDER BY m.entity_slug, l.id
    `);

    const totalLines = rows.length;
    const nullCoaRows = rows.filter(r => !r.coa_account_id);
    const candidateRows = rows.filter(r => r.coa_account_id);

    console.log(`\n=== DRY-RUN QBO Account Metadata Backfill ===`);
    console.log(`Total historical lines:      ${totalLines}`);
    console.log(`Lines with null coa_account_id: ${nullCoaRows.length}`);
    console.log(`Candidate lines for matching:   ${candidateRows.length}`);

    // 2. Unique entity slugs
    const entitySlugs = [...new Set(rows.map(r => r.entity_slug))];
    console.log(`\nEntities found: ${entitySlugs.join(", ")}`);

    // 3. Resolve entityId and load COA once per entity
    const coaByEntity = new Map<string, Map<string, {
      name: string;
      fullyQualifiedName: string | null;
      accountSubtype: string | null;
      classification: string | null;
    }>>();

    for (const slug of entitySlugs) {
      const entityId = await getCachedEntityId(slug);
      if (!entityId) {
        console.warn(`  WARNING: no entityId for slug "${slug}" — lines will be unmatched`);
        coaByEntity.set(slug, new Map());
        continue;
      }
      const accounts = await getAllAccounts(entityId);

      // Detect duplicate qboId within entity
      const qboIdCounts = new Map<string, number>();
      for (const acct of accounts) {
        const k = String(acct.qboId);
        qboIdCounts.set(k, (qboIdCounts.get(k) ?? 0) + 1);
      }
      const dupes = [...qboIdCounts.entries()].filter(([, c]) => c > 1);
      if (dupes.length > 0) {
        console.error(`\nSTOP: Duplicate qboId values found in entity "${slug}":`);
        dupes.forEach(([id, count]) => console.error(`  qboId=${id} appears ${count} times`));
        process.exit(1);
      }

      const lookup = new Map<string, typeof coaByEntity extends Map<string, Map<string, infer V>> ? V : never>();
      for (const acct of accounts) {
        lookup.set(String(acct.qboId), {
          name: acct.name,
          fullyQualifiedName: acct.fullyQualifiedName ?? null,
          accountSubtype: acct.accountSubtype ?? null,
          classification: acct.classification ?? null,
        });
      }
      coaByEntity.set(slug, lookup as Map<string, { name: string; fullyQualifiedName: string | null; accountSubtype: string | null; classification: string | null; }>);
      console.log(`  ${slug}: ${accounts.length} Core COA accounts loaded`);
    }

    // 4. Classify each candidate row
    type UpdateCandidate = {
      id: string;
      entity_slug: string;
      coa_account_id: string;
      coa_account_name: string | null;
      matched_name: string;
      fullyQualifiedName: string | null;
      accountSubtype: string | null;
      classification: string | null;
    };

    const toUpdate: UpdateCandidate[] = [];
    const alreadyCorrect: string[] = [];
    const unmatched: { entity_slug: string; coa_account_id: string; coa_account_name: string | null }[] = [];

    for (const row of candidateRows) {
      const lookup = coaByEntity.get(row.entity_slug);
      const acct = lookup?.get(row.coa_account_id!);

      if (!acct) {
        unmatched.push({ entity_slug: row.entity_slug, coa_account_id: row.coa_account_id!, coa_account_name: row.coa_account_name });
        continue;
      }

      const alreadyFqn   = row.coa_account_fully_qualified_name === (acct.fullyQualifiedName ?? null);
      const alreadySub   = row.coa_account_subtype               === (acct.accountSubtype    ?? null);
      const alreadyClass = row.coa_account_classification         === (acct.classification    ?? null);

      if (alreadyFqn && alreadySub && alreadyClass) {
        alreadyCorrect.push(row.id);
        continue;
      }

      toUpdate.push({
        id: row.id,
        entity_slug: row.entity_slug,
        coa_account_id: row.coa_account_id!,
        coa_account_name: row.coa_account_name,
        matched_name: acct.name,
        fullyQualifiedName: acct.fullyQualifiedName ?? null,
        accountSubtype: acct.accountSubtype ?? null,
        classification: acct.classification ?? null,
      });
    }

    // 5. Counts by entity
    console.log(`\n=== Counts by entity_slug ===`);
    for (const slug of entitySlugs) {
      const slugTotal   = rows.filter(r => r.entity_slug === slug).length;
      const slugUpdate  = toUpdate.filter(r => r.entity_slug === slug).length;
      const slugCorrect = alreadyCorrect.filter(id => rows.find(r => r.id === id && r.entity_slug === slug)).length;
      const slugUnmatch = unmatched.filter(r => r.entity_slug === slug).length;
      const slugNull    = nullCoaRows.filter(r => r.entity_slug === slug).length;
      console.log(`  ${slug}: total=${slugTotal} would_update=${slugUpdate} already_correct=${slugCorrect} unmatched=${slugUnmatch} null_id=${slugNull}`);
    }

    // 6. Summary
    console.log(`\n=== Summary ===`);
    console.log(`Matched (would update):  ${toUpdate.length}`);
    console.log(`Already correct:         ${alreadyCorrect.length}`);
    console.log(`Unmatched:               ${unmatched.length}`);
    console.log(`Null coa_account_id:     ${nullCoaRows.length}`);

    // 7. Sample per entity (up to 3)
    console.log(`\n=== Sample matches per entity ===`);
    for (const slug of entitySlugs) {
      const sample = toUpdate.filter(r => r.entity_slug === slug).slice(0, 3);
      if (sample.length === 0) continue;
      console.log(`\n  ${slug}:`);
      sample.forEach(r => {
        console.log(`    coa_account_id:   ${r.coa_account_id}`);
        console.log(`    existing name:    ${r.coa_account_name ?? "(null)"}`);
        console.log(`    Core name:        ${r.matched_name}`);
        console.log(`    fullyQualified:   ${r.fullyQualifiedName ?? "(null)"}`);
        console.log(`    subtype:          ${r.accountSubtype ?? "(null)"}`);
        console.log(`    classification:   ${r.classification ?? "(null)"}`);
        console.log(`    ---`);
      });
    }

    // 8. Unmatched breakdown
    if (unmatched.length > 0) {
      console.log(`\n=== Unmatched breakdown ===`);
      const grouped = new Map<string, { entity_slug: string; coa_account_id: string; coa_account_name: string | null; count: number }>();
      for (const u of unmatched) {
        const k = `${u.entity_slug}|${u.coa_account_id}`;
        const existing = grouped.get(k) ?? { ...u, count: 0 };
        existing.count += 1;
        grouped.set(k, existing);
      }
      for (const u of grouped.values()) {
        console.log(`  entity=${u.entity_slug}  coa_account_id=${u.coa_account_id}  name=${u.coa_account_name ?? "(null)"}  count=${u.count}`);
      }
    }

    if (!APPLY) {
      console.log(`\nDRY-RUN COMPLETE — no data was modified. Re-run with --apply to write.`);
      return;
    }

    // ── APPLY MODE ──────────────────────────────────────────────────────────
    if (toUpdate.length === 0) {
      console.log(`\nNothing to update — all rows already correct.`);
      return;
    }

    console.log(`\nApplying ${toUpdate.length} updates...`);
    await client.query("BEGIN");
    try {
      let updated = 0;
      for (const row of toUpdate) {
        await client.query(
          `UPDATE bank_transaction_qbo_lines
           SET coa_account_fully_qualified_name = $1,
               coa_account_subtype              = $2,
               coa_account_classification       = $3
           WHERE id = $4`,
          [row.fullyQualifiedName, row.accountSubtype, row.classification, row.id],
        );
        updated += 1;
      }
      await client.query("COMMIT");
      console.log(`Updated ${updated} rows.`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("ROLLBACK — error during update:", err);
      process.exit(1);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
