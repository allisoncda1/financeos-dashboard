/**
 * Feature flags — deployment-controlled kill switches.
 *
 * Read fresh from process.env on every call, never cached at module load:
 * a flag must never be assumed "on" by default. Absent, empty, or any value
 * other than the exact string "true" means disabled.
 */

/**
 * COMMISSION_DOCUMENTS_ENABLED — gates the entire Commission Documents
 * feature (upload, extraction, allocation, review workflow) behind a single
 * deployment-controlled switch. When disabled: the Documents nav item and
 * routes are absent on the frontend, every backend endpoint under
 * /commissions/:slug/documents/* refuses cleanly before touching any table,
 * object storage, or AI provider, and every other Commissions page keeps
 * working exactly as before. See routes/commissionDocuments.ts's
 * requireCommissionDocumentsEnabled middleware and routes/auth.ts's /me
 * response for the two places this is consumed.
 */
export function isCommissionDocumentsEnabled(): boolean {
  return process.env["COMMISSION_DOCUMENTS_ENABLED"] === "true";
}
