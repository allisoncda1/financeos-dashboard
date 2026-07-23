/**
 * GET /api/users — list all DB-resident users (no env-var accounts exposed here).
 * Requires user-management permission.
 */

import { Router, type IRouter } from "express";
import { requirePermission } from "../auth/permissions.js";
import { listAppUsers } from "../auth/invitationService.js";

const router: IRouter = Router();

router.get("/users", requirePermission("user-management"), async (_req, res) => {
  try {
    const users = await listAppUsers();
    res.json({ ok: true, data: users, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(503).json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
});

export default router;
