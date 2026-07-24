/**
 * plaidClient.ts — Plaid API singleton.
 *
 * FAIL-CLOSED: throws at module load time if PLAID_ENV is missing or not
 * "production". The server will not start without correct Plaid configuration.
 * No silent sandbox fallback — production credentials are required.
 *
 * Usage:
 *   import { plaidClient, plaidEnv } from '../lib/plaidClient';
 *   const res = await plaidClient.linkTokenCreate({ ... });
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// ─── Fail-closed startup validation ──────────────────────────────────────────

const env = process.env["PLAID_ENV"];
if (!env) {
  throw new Error(
    "[Plaid] PLAID_ENV is required — set to 'production'. " +
    "Server will not start without it.",
  );
}
if (env !== "production") {
  throw new Error(
    `[Plaid] PLAID_ENV must be 'production', got '${env}'. ` +
    "Server refuses to start with non-production Plaid configuration.",
  );
}

// Validate credentials present (never log values)
const clientId = process.env["PLAID_CLIENT_ID"];
const secret = process.env["PLAID_SECRET"];
if (!clientId || !secret) {
  throw new Error(
    "[Plaid] PLAID_CLIENT_ID and PLAID_SECRET are required. " +
    "Provision them in Replit Secrets. Never commit credentials to source code.",
  );
}

// Log only safe metadata — never log credential values
console.info(
  "[Plaid] Environment: production. Credentials: present. SDK initializing.",
);

// ─── SDK configuration ────────────────────────────────────────────────────────

export const plaidEnv = env;

const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": clientId,
      "PLAID-SECRET": secret,
    },
  },
});

/**
 * Singleton Plaid API client.
 * All routes share this instance — do not instantiate additional clients.
 */
export const plaidClient = new PlaidApi(configuration);
