/**
 * Invitation endpoints — create, look up, accept, and revoke invitations.
 *
 * Security notes:
 *   - POST /api/invitations requires user-management permission.
 *   - GET  /api/invitations/:token is public (called from the accept-invite page).
 *   - POST /api/invitations/:token/accept is public (sets password, creates user).
 *   - POST /api/invitations/:id/revoke requires user-management permission.
 *   - Raw tokens are never logged. token_hash is never sent to the frontend.
 *   - After accept, the user must complete MFA enrollment before full access.
 *   - display_name is derived server-side from first_name + last_name; client-provided
 *     display_name is never accepted or trusted.
 */

import { Router, type IRouter } from "express";
import { requirePermission } from "../auth/permissions.js";
import {
  createInvitation,
  lookupInvitationByToken,
  acceptInvitation,
  revokeInvitation,
  listInvitations,
} from "../auth/invitationService.js";
import type { Role } from "../auth/types.js";

const VALID_ROLES: Role[] = ["admin", "cfo", "controller", "bookkeeper", "investor", "readonly"];

// Public router — accessible without a session (invite accept flow)
const publicRouter: IRouter = Router();
// Protected router — requires session + user-management permission (management endpoints)
const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/invitations — list all invitations (admin view)
// ---------------------------------------------------------------------------

router.get("/invitations", requirePermission("user-management"), async (_req, res) => {
  try {
    const invitations = await listInvitations();
    res.json({ ok: true, data: invitations, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// POST /api/invitations — create a new invitation
// ---------------------------------------------------------------------------

router.post("/invitations", requirePermission("user-management"), async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const email = typeof body?.["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  const firstName = typeof body?.["first_name"] === "string" ? body["first_name"].trim() : "";
  const lastName = typeof body?.["last_name"] === "string" ? body["last_name"].trim() : "";
  const role = typeof body?.["role"] === "string" ? body["role"] : "";

  if (!email) {
    res.status(400).json({ ok: false, error: "email is required", ts: new Date().toISOString() });
    return;
  }
  if (!firstName) {
    res.status(400).json({ ok: false, error: "first_name is required and must not be empty", ts: new Date().toISOString() });
    return;
  }
  if (!lastName) {
    res.status(400).json({ ok: false, error: "last_name is required and must not be empty", ts: new Date().toISOString() });
    return;
  }
  if (!role) {
    res.status(400).json({ ok: false, error: "role is required", ts: new Date().toISOString() });
    return;
  }
  if (!VALID_ROLES.includes(role as Role)) {
    res.status(400).json({ ok: false, error: `role must be one of: ${VALID_ROLES.join(", ")}`, ts: new Date().toISOString() });
    return;
  }

  const actorEmail = req.session.user!.email;

  try {
    const { invitation, rawToken } = await createInvitation({
      email,
      firstName,
      lastName,
      role: role as Role,
      invitedBy: actorEmail,
    });

    // Build the accept URL — use APP_PUBLIC_URL env var or fall back to the request origin.
    const baseUrl = process.env["APP_PUBLIC_URL"] ?? `${req.protocol}://${req.get("host")}`;
    const inviteUrl = `${baseUrl}/invite/accept?token=${rawToken}`;

    // Return the raw token once (as the invite URL). It is NEVER logged or stored.
    res.status(201).json({
      ok: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        display_name: invitation.display_name,
        role: invitation.role,
        invited_by: invitation.invited_by,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
        invite_url: inviteUrl,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    // Treat duplicate email as a 409
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      res.status(409).json({ ok: false, error: "An invitation for this email already exists or the user already has an account", ts: new Date().toISOString() });
      return;
    }
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/invitations/:token — validate a token (public; called from accept page)
// ---------------------------------------------------------------------------

publicRouter.get("/invitations/:token", async (req, res) => {
  const rawToken = req.params["token"] ?? "";
  if (!rawToken) {
    res.status(400).json({ ok: false, error: "Token is required", ts: new Date().toISOString() });
    return;
  }

  try {
    const inv = await lookupInvitationByToken(rawToken);

    if (!inv) {
      // Generic message — no oracle about what went wrong
      res.status(404).json({ ok: false, error: "Invalid or expired invitation", ts: new Date().toISOString() });
      return;
    }

    if (inv.accepted_at || inv.revoked_at || new Date() > new Date(inv.expires_at)) {
      res.status(410).json({ ok: false, error: "This invitation is no longer valid", ts: new Date().toISOString() });
      return;
    }

    // Return only the minimum fields needed to pre-fill the accept form.
    // first_name and last_name are not returned — the accept page has no need
    // for structured names and this limits public data exposure.
    res.json({
      ok: true,
      data: {
        email: inv.email,
        display_name: inv.display_name,
        role: inv.role,
        expires_at: inv.expires_at,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// POST /api/invitations/:token/accept — consume token, create user, require MFA
// ---------------------------------------------------------------------------

publicRouter.post("/invitations/:token/accept", async (req, res) => {
  const rawToken = req.params["token"] ?? "";
  const body = req.body as Record<string, unknown> | undefined;
  const password = typeof body?.["password"] === "string" ? body["password"] : "";

  if (!rawToken || !password) {
    res.status(400).json({ ok: false, error: "token and password are required", ts: new Date().toISOString() });
    return;
  }

  if (password.length < 12) {
    res.status(400).json({ ok: false, error: "Password must be at least 12 characters", ts: new Date().toISOString() });
    return;
  }

  try {
    const user = await acceptInvitation({ rawToken, password });

    // User created. Return their details but do NOT log them in yet —
    // they must complete MFA enrollment on the next step.
    res.status(201).json({
      ok: true,
      data: {
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        mfa_required: user.mfa_required,
        mfa_complete: user.mfa_complete,
      },
      message: "Account created. Please log in and complete MFA enrollment to activate your account.",
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "INVALID_TOKEN") {
      res.status(404).json({ ok: false, error: "Invalid or expired invitation", ts: new Date().toISOString() });
      return;
    }
    if (code === "ALREADY_ACCEPTED") {
      res.status(409).json({ ok: false, error: "This invitation has already been used", ts: new Date().toISOString() });
      return;
    }
    if (code === "REVOKED") {
      res.status(410).json({ ok: false, error: "This invitation has been revoked", ts: new Date().toISOString() });
      return;
    }
    if (code === "EXPIRED") {
      res.status(410).json({ ok: false, error: "This invitation has expired", ts: new Date().toISOString() });
      return;
    }
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// POST /api/invitations/:id/revoke — revoke a pending invitation
// ---------------------------------------------------------------------------

router.post("/invitations/:id/revoke", requirePermission("user-management"), async (req, res) => {
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";
  if (!id) {
    res.status(400).json({ ok: false, error: "id is required", ts: new Date().toISOString() });
    return;
  }

  const actorEmail = req.session.user!.email;

  try {
    await revokeInvitation({ id, actorEmail });
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      res.status(404).json({ ok: false, error: "Invitation not found or already consumed", ts: new Date().toISOString() });
      return;
    }
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

export { publicRouter as invitationsPublicRouter };
export default router;
