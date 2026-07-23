import { useState } from "react";
import { Users, UserPlus, Copy, Check, ShieldCheck, ShieldOff, Clock, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = "admin" | "cfo" | "controller" | "bookkeeper" | "investor" | "readonly";

type AppUser = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: string;
  mfa_complete: boolean;
  created_at: string;
  last_login_at: string | null;
};

type Invitation = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type InviteResult = {
  id: string;
  email: string;
  role: Role;
  invite_url: string;
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch("/api/users", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  const json = await res.json();
  return json.data as AppUser[];
}

async function fetchInvitations(): Promise<Invitation[]> {
  const res = await fetch("/api/invitations", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load invitations: ${res.status}`);
  const json = await res.json();
  return json.data as Invitation[];
}

async function postInvitation(payload: {
  email: string;
  display_name: string;
  role: Role;
}): Promise<InviteResult> {
  const res = await fetch("/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json.data as InviteResult;
}

async function revokeInvitation(id: string): Promise<void> {
  const res = await fetch(`/api/invitations/${id}/revoke`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  cfo: "CFO",
  controller: "Controller",
  bookkeeper: "Bookkeeper",
  investor: "Investor",
  readonly: "Read-Only",
};

const ROLE_COLORS: Record<Role, string> = {
  admin:      "bg-red-50 text-red-700",
  cfo:        "bg-purple-50 text-purple-700",
  controller: "bg-blue-50 text-blue-700",
  bookkeeper: "bg-teal-50 text-teal-700",
  investor:   "bg-amber-50 text-amber-700",
  readonly:   "bg-gray-100 text-gray-600",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Invite form
// ---------------------------------------------------------------------------

type InviteFormProps = {
  onSuccess: (result: InviteResult) => void;
  onClose: () => void;
};

function InviteForm({ onSuccess, onClose }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("readonly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await postInvitation({ email, display_name: displayName, role });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-900">Invite user</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={(e) => { void submit(e); }} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="First Last"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                <option key={r} value={r}>{label}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-[12px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating…" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite result modal (shows copyable link)
// ---------------------------------------------------------------------------

function InviteResultModal({ result, onClose }: { result: InviteResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-gray-900">Invitation created</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-[12px] text-gray-600">
            Share this link with <strong>{result.email}</strong>. It expires in 7 days and can only be used once.
            This link will not be shown again.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-[11px] font-mono text-gray-700 break-all leading-relaxed">{result.invite_url}</p>
          </div>
          <div className="flex gap-2">
            <CopyButton text={result.invite_url} />
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Done
            </button>
          </div>
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            The invited user must set a password and complete MFA enrollment before they can access FinanceOS.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UsersAccessPage() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, inv] = await Promise.all([fetchUsers(), fetchInvitations()]);
      setUsers(u);
      setInvitations(inv);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Trigger initial load
  if (users === null && invitations === null && !loading && !loadError) {
    void load();
  }

  const handleInviteSuccess = (result: InviteResult) => {
    setShowInviteForm(false);
    setInviteResult(result);
    void load();
  };

  const handleRevoke = async (id: string) => {
    setRevokeError(null);
    try {
      await revokeInvitation(id);
      void load();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke");
    }
  };

  const pendingInvitations = (invitations ?? []).filter(
    (inv) => !inv.accepted_at && !inv.revoked_at && new Date(inv.expires_at) > new Date(),
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">Users &amp; Access</h1>
            <p className="text-[11px] text-gray-500">Manage who can access FinanceOS</p>
          </div>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Invite user
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-[12px] text-red-600">{loadError}</p>
          <button onClick={() => void load()} className="mt-1 text-[11px] text-red-700 underline">
            Retry
          </button>
        </div>
      )}
      {revokeError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-[12px] text-red-600">{revokeError}</p>
        </div>
      )}

      {/* Active users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
          <h2 className="text-[12px] font-semibold text-gray-800">Active users</h2>
          {users !== null && (
            <span className="ml-auto text-[10px] text-gray-400">{users.length} user{users.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {loading && <p className="px-4 py-6 text-[12px] text-gray-400">Loading…</p>}
        {!loading && users !== null && users.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-gray-400">No DB-resident users yet. Invite someone to get started.</p>
        )}
        {!loading && users !== null && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Name", "Email", "Role", "MFA", "Status", "Created", "Last login"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-gray-800 whitespace-nowrap">{u.display_name}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.mfa_complete ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <ShieldCheck className="w-3 h-3" /> Enrolled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                          <ShieldOff className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.status === "active" ? (
                        <StatusBadge label="Active" color="bg-emerald-50 text-emerald-700" />
                      ) : (
                        <StatusBadge label="Disabled" color="bg-red-50 text-red-700" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{formatDate(u.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <h2 className="text-[12px] font-semibold text-gray-800">Pending invitations</h2>
          {invitations !== null && (
            <span className="ml-auto text-[10px] text-gray-400">{pendingInvitations.length} pending</span>
          )}
        </div>
        {loading && <p className="px-4 py-6 text-[12px] text-gray-400">Loading…</p>}
        {!loading && invitations !== null && pendingInvitations.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-gray-400">No pending invitations.</p>
        )}
        {!loading && pendingInvitations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Email", "Name", "Role", "Invited by", "Expires", ""].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-[12px] text-gray-700 whitespace-nowrap">{inv.email}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">{inv.display_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={inv.role} /></td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{inv.invited_by}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{formatDate(inv.expires_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => void handleRevoke(inv.id)}
                        className="text-[10px] font-medium text-red-600 hover:text-red-800 transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteForm && (
        <InviteForm
          onSuccess={handleInviteSuccess}
          onClose={() => setShowInviteForm(false)}
        />
      )}
      {inviteResult && (
        <InviteResultModal
          result={inviteResult}
          onClose={() => setInviteResult(null)}
        />
      )}
    </div>
  );
}
