/**
 * Invitation service — token generation, DB CRUD, and audit logging.
 *
 * Security invariants:
 *   - Raw tokens are generated with crypto.randomBytes(32); they are NEVER stored.
 *   - Only the SHA-256 hex digest (token_hash) is persisted.
 *   - Tokens are single-use: accepted_at is set on first acceptance; subsequent
 *     attempts are rejected before any DB write.
 *   - Invitations expire after 7 days (expires_at).
 *   - No token, password, or hash is ever logged.
 *   - All tables live in DATABASE_URL (operational DB). CORE_DATABASE_URL is not touched.
 */

import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import type { Role } from "./types.js";

// ---------------------------------------------------------------------------
// DB pool — DATABASE_URL only
// ---------------------------------------------------------------------------

const dbUrl = process.env["DATABASE_URL"];
const pool = dbUrl ? new Pool({ connectionString: dbUrl }) : null;

async function query<T extends object>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
  if (!pool) throw new Error("DATABASE_URL not configured — invitation service unavailable");
  return pool.query<T>(sql, params);
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvitationRow = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  invited_by: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
};

export type AppUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  password_hash: string;
  status: string;
  mfa_required: boolean;
  mfa_complete: boolean;
  invited_by: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createInvitation(params: {
  email: string;
  displayName: string;
  role: Role;
  invitedBy: string;
}): Promise<{ invitation: InvitationRow; rawToken: string }> {
  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { rows } = await query<InvitationRow>(
    `INSERT INTO user_invitations (email, display_name, role, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, display_name, role, invited_by, expires_at, accepted_at, revoked_at, created_at`,
    [params.email, params.displayName, params.role, tokenHash, params.invitedBy, expiresAt],
  );

  const invitation = rows[0];
  if (!invitation) throw new Error("Failed to create invitation");

  await writeAuditLog({
    actorEmail: params.invitedBy,
    action: "invite_created",
    targetEmail: params.email,
    details: { invitation_id: invitation.id, role: params.role },
  });

  // rawToken is returned to the caller once and never stored anywhere.
  return { invitation, rawToken };
}

export async function lookupInvitationByToken(rawToken: string): Promise<InvitationRow | null> {
  const tokenHash = hashToken(rawToken);
  const { rows } = await query<InvitationRow>(
    `SELECT id, email, display_name, role, invited_by, expires_at, accepted_at, revoked_at, created_at
     FROM user_invitations WHERE token_hash = $1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function acceptInvitation(params: {
  rawToken: string;
  password: string; // plaintext from user; bcrypt-hashed before DB write
}): Promise<AppUserRow> {
  const tokenHash = hashToken(params.rawToken);

  // Load and validate the invitation
  const { rows: invRows } = await query<InvitationRow>(
    `SELECT id, email, display_name, role, invited_by, expires_at, accepted_at, revoked_at, created_at
     FROM user_invitations WHERE token_hash = $1`,
    [tokenHash],
  );
  const inv = invRows[0];
  if (!inv) throw Object.assign(new Error("Invalid invitation token"), { code: "INVALID_TOKEN" });
  if (inv.accepted_at) throw Object.assign(new Error("Invitation already accepted"), { code: "ALREADY_ACCEPTED" });
  if (inv.revoked_at) throw Object.assign(new Error("Invitation has been revoked"), { code: "REVOKED" });
  if (new Date() > new Date(inv.expires_at)) throw Object.assign(new Error("Invitation has expired"), { code: "EXPIRED" });

  // Hash the password at cost 12 before any DB write
  const passwordHash = await bcrypt.hash(params.password, 12);

  // Mark invitation accepted and create the user atomically
  const dbClient = pool ? await pool.connect() : null;
  if (!dbClient) throw new Error("DATABASE_URL not configured");

  try {
    await dbClient.query("BEGIN");

    await dbClient.query(
      `UPDATE user_invitations SET accepted_at = now() WHERE id = $1`,
      [inv.id],
    );

    const { rows: userRows } = await dbClient.query<AppUserRow>(
      `INSERT INTO app_users (email, display_name, role, password_hash, invited_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role, password_hash, status, mfa_required, mfa_complete,
                 invited_by, created_at, updated_at, last_login_at`,
      [inv.email, inv.display_name, inv.role, passwordHash, inv.invited_by],
    );

    await dbClient.query("COMMIT");

    const user = userRows[0];
    if (!user) throw new Error("Failed to create user from invitation");

    await writeAuditLog({
      actorEmail: inv.email,
      action: "invite_accepted",
      targetEmail: inv.email,
      details: { invitation_id: inv.id, role: inv.role },
    });

    return user;
  } catch (err) {
    await dbClient.query("ROLLBACK");
    throw err;
  } finally {
    dbClient.release();
  }
}

export async function revokeInvitation(params: {
  id: string;
  actorEmail: string;
}): Promise<void> {
  const { rows } = await query<InvitationRow>(
    `UPDATE user_invitations
     SET revoked_at = now()
     WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
     RETURNING id, email, role`,
    [params.id],
  );
  const inv = rows[0];
  if (!inv) throw Object.assign(new Error("Invitation not found or already consumed"), { code: "NOT_FOUND" });

  await writeAuditLog({
    actorEmail: params.actorEmail,
    action: "invite_revoked",
    targetEmail: inv.email,
    details: { invitation_id: inv.id },
  });
}

export async function listInvitations(): Promise<InvitationRow[]> {
  const { rows } = await query<InvitationRow>(
    `SELECT id, email, display_name, role, invited_by, expires_at, accepted_at, revoked_at, created_at
     FROM user_invitations
     ORDER BY created_at DESC`,
    [],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// App users
// ---------------------------------------------------------------------------

export async function listAppUsers(): Promise<Omit<AppUserRow, "password_hash">[]> {
  const { rows } = await query<Omit<AppUserRow, "password_hash">>(
    `SELECT id, email, display_name, role, status, mfa_required, mfa_complete,
            invited_by, created_at, updated_at, last_login_at
     FROM app_users
     ORDER BY created_at ASC`,
    [],
  );
  return rows;
}

export async function findAppUserByEmail(email: string): Promise<AppUserRow | null> {
  const { rows } = await query<AppUserRow>(
    `SELECT id, email, display_name, role, password_hash, status, mfa_required, mfa_complete,
            invited_by, created_at, updated_at, last_login_at
     FROM app_users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function markUserMfaComplete(email: string): Promise<void> {
  await query(
    `UPDATE app_users SET mfa_complete = true, updated_at = now() WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
}

export async function updateUserLastLogin(email: string): Promise<void> {
  await query(
    `UPDATE app_users SET last_login_at = now(), updated_at = now() WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function writeAuditLog(params: {
  actorEmail: string;
  action: string;
  targetEmail: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  // Best-effort: never let audit logging crash the main operation.
  try {
    await query(
      `INSERT INTO user_audit_log (actor_email, action, target_email, details)
       VALUES ($1, $2, $3, $4)`,
      [params.actorEmail, params.action, params.targetEmail, JSON.stringify(params.details ?? {})],
    );
  } catch {
    // Audit log failures are intentionally swallowed to not block user operations.
    // In production, add a dead-letter queue or alert here.
  }
}
