/**
 * Plaid routes — consent, connection management, and disconnection.
 *
 * FOUNDATION ONLY: Plaid SDK is not yet installed. These routes establish
 * the consent gate and data model. Actual Plaid Link integration requires:
 * 1. Plaid production approval
 * 2. Installing @plaid/plaid-node
 * 3. Configuring PLAID_CLIENT_ID and PLAID_SECRET in Replit Secrets
 */
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import {
  PLAID_CONSENT_TEXT,
  CURRENT_PRIVACY_POLICY_VERSION,
  consentTextHash,
} from "../services/consentService";

const router = Router();

// GET /api/plaid/consent-info — returns consent text and policy version
// Frontend must display this before showing Plaid Link
router.get("/consent-info", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    data: {
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      consentText: PLAID_CONSENT_TEXT,
      consentTextHash: consentTextHash(),
    },
    ts: new Date().toISOString(),
  });
});

// POST /api/plaid/consent — record user consent before Plaid Link
// Body: { entityId, scopeRequested?, plaidProducts? }
router.post("/consent", requireAuth, (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!body["entityId"] || typeof body["entityId"] !== "string") {
    res.status(400).json({ ok: false, error: "entityId required", ts: new Date().toISOString() });
    return;
  }

  // TODO: persist consent record to plaid_consent_records table when migration is applied
  // For now, return the record that would be persisted
  res.json({
    ok: true,
    data: {
      message: "Consent recorded. Plaid integration is not yet active.",
      consentTextHash: consentTextHash(),
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    },
    ts: new Date().toISOString(),
  });
});

// POST /api/plaid/disconnect/:connectionId — revoke access token and mark connection disconnected
router.post("/disconnect/:connectionId", requireAuth, (_req, res) => {
  // TODO: Revoke Plaid access token via Plaid API, update plaid_connections.status = 'disconnected'
  res.json({
    ok: true,
    data: { message: "Plaid not yet integrated. Disconnection workflow is ready." },
    ts: new Date().toISOString(),
  });
});

// POST /api/plaid/deletion-request — data deletion request
router.post("/deletion-request", requireAuth, (req, res) => {
  const user = req.session.user!;
  const body = req.body as Record<string, unknown>;

  req.log.info({ userEmail: user.email, requestType: body["requestType"] }, "Data deletion request received");

  // TODO: persist to data_deletion_requests table when migration is applied
  res.json({
    ok: true,
    data: { message: "Deletion request received. An administrator will process it within 30 days." },
    ts: new Date().toISOString(),
  });
});

export default router;
