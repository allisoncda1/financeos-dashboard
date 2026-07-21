/**
 * Plaid consent service — manages explicit user consent before Plaid Link is surfaced.
 *
 * IMPORTANT: Plaid is not yet integrated. This service establishes the consent
 * infrastructure required before any Plaid connection can be made. No live
 * Plaid credentials are used here.
 */
import crypto from "crypto";

export const CURRENT_PRIVACY_POLICY_VERSION = "privacy-v1.0";

export const PLAID_CONSENT_TEXT = `
FinanceOS will connect to your bank accounts via Plaid to retrieve:
• Account balances and transaction history
• Account and routing numbers (for verification)

Purpose: Internal financial reporting and AR/AP reconciliation for your entities.
Storage: Encrypted access tokens stored in FinanceOS database.
Retention: Access tokens retained until you disconnect the bank connection.
Recipients: FinanceOS only. Data is not sold or shared with third parties.
Disconnect: You may disconnect any bank connection at any time from Settings.
Deletion: Request deletion via your account administrator.

By continuing, you consent to the above data access and processing.
`.trim();

export function consentTextHash(): string {
  return crypto
    .createHash("sha256")
    .update(PLAID_CONSENT_TEXT)
    .digest("hex");
}

export function buildConsentRecord(params: {
  userEmail: string;
  entityId: string;
  policyVersion?: string;
  scopeRequested?: string[];
  plaidProducts?: string[];
  ipAddress?: string;
  userAgent?: string;
}) {
  return {
    user_email: params.userEmail,
    entity_id: params.entityId,
    policy_version: params.policyVersion ?? CURRENT_PRIVACY_POLICY_VERSION,
    consent_text_hash: consentTextHash(),
    scope_requested: params.scopeRequested ?? ["transactions", "balances"],
    plaid_products: params.plaidProducts ?? ["auth", "transactions"],
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  };
}
