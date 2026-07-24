/**
 * plaidClient.ts — Plaid API singleton.
 *
 * Reads PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV from process.env.
 * Logs a warning (never the secret values) when vars are missing.
 * Does NOT crash at startup — the sandbox client requires credentials but
 * we want the server to boot in partial-config environments.
 *
 * Usage:
 *   import { plaidClient, plaidEnv } from '../lib/plaidClient';
 *   const res = await plaidClient.linkTokenCreate({ ... });
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const clientId = process.env["PLAID_CLIENT_ID"];
const secret = process.env["PLAID_SECRET"];
const rawEnv = process.env["PLAID_ENV"] ?? "sandbox";

// Validate required configuration at startup — warn but don't crash.
const missingVars: string[] = [];
if (!clientId) missingVars.push("PLAID_CLIENT_ID");
if (!secret) missingVars.push("PLAID_SECRET");

if (missingVars.length > 0) {
  console.warn(
    `[plaid] WARNING: Missing env vars: ${missingVars.join(", ")}. ` +
      "Plaid Link and sync routes will fail until these are set in Replit Secrets. " +
      "Never commit credentials to source code.",
  );
}

// Resolve Plaid environment URL. Defaults to sandbox.
function resolvePlaidEnv(env: string): string {
  switch (env.toLowerCase()) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    case "sandbox":
    default:
      return PlaidEnvironments.sandbox;
  }
}

export const plaidEnv = rawEnv;
const basePath = resolvePlaidEnv(rawEnv);

const configuration = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": clientId ?? "",
      "PLAID-SECRET": secret ?? "",
    },
  },
});

/**
 * Singleton Plaid API client.
 * All routes share this instance — do not instantiate additional clients.
 */
export const plaidClient = new PlaidApi(configuration);
