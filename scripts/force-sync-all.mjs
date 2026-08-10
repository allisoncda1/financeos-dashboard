import pg from "pg";
import crypto from "crypto";
import { PlaidApi, PlaidEnvironments, Configuration } from "plaid";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function query(sql, params = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

const plaidEnv = process.env.PLAID_ENV ?? "production";
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: { headers: {
    "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
    "PLAID-SECRET": process.env.PLAID_SECRET,
  }},
});
const plaidClient = new PlaidApi(plaidConfig);

function decryptAccessToken(encryptedHex, ivHex, tagHex) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function syncItem(item) {
  const accessToken = decryptAccessToken(item.access_token_encrypted, item.access_token_iv, item.access_token_tag);
  let cursor = item.transactions_cursor || undefined;
  let hasMore = true;
  let added = 0, modified = 0, removed = 0;
  while (hasMore) {
    const res = await plaidClient.transactionsSync({ access_token: accessToken, cursor, count: 500 });
    const data = res.data;
    for (const txn of data.added) {
      await query(
        `INSERT INTO bank_transactions (plaid_transaction_id, plaid_account_id, plaid_item_id, entity_slug, date, authorized_date, name, merchant_name, amount, iso_currency_code, category, category_id, pending, account_owner, payment_channel, transaction_type, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
         ON CONFLICT (plaid_transaction_id) DO UPDATE SET name=EXCLUDED.name, merchant_name=EXCLUDED.merchant_name, amount=EXCLUDED.amount, pending=EXCLUDED.pending, category=EXCLUDED.category, updated_at=NOW()`,
        [txn.transaction_id, txn.account_id, item.plaid_item_id, item.entity_slug, txn.date, txn.authorized_date??null, txn.name, txn.merchant_name??null, txn.amount, txn.iso_currency_code??"USD", txn.personal_finance_category?.primary??null, txn.category_id??null, txn.pending, txn.account_owner??null, txn.payment_channel??null, txn.transaction_type??null]
      );
      added++;
    }
    for (const txn of data.modified) {
      await query(`UPDATE bank_transactions SET name=$2, merchant_name=$3, amount=$4, pending=$5, category=$6, updated_at=NOW() WHERE plaid_transaction_id=$1`,
        [txn.transaction_id, txn.name, txn.merchant_name??null, txn.amount, txn.pending, txn.personal_finance_category?.primary??null]);
      modified++;
    }
    for (const txn of data.removed) {
      await query(`DELETE FROM bank_transactions WHERE plaid_transaction_id=$1`, [txn.transaction_id]);
      removed++;
    }
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }
  await query(`UPDATE plaid_items SET transactions_cursor=$1, last_successful_sync_at=NOW(), updated_at=NOW() WHERE plaid_item_id=$2`, [cursor, item.plaid_item_id]);
  return { added, modified, removed };
}

const itemsRes = await query(`SELECT plaid_item_id, institution_name, entity_slug, access_token_encrypted, access_token_iv, access_token_tag, transactions_cursor FROM plaid_items WHERE status='active' ORDER BY institution_name`);
console.log(`\nFound ${itemsRes.rows.length} active items.\n`);
for (const item of itemsRes.rows) {
  process.stdout.write(`→ ${item.institution_name} (${item.entity_slug}) ... `);
  try {
    const r = await syncItem(item);
    console.log(`✓ added=${r.added} modified=${r.modified} removed=${r.removed}`);
  } catch(err) {
    const msg = err?.response?.data?.error_message ?? err?.message ?? String(err);
    const code = err?.response?.data?.error_code ?? "";
    console.log(`✗ ${code} ${msg}`);
  }
}
await pool.end();
console.log("\nDone.");
