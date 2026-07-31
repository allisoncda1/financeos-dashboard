/**
 * Banking page — Plaid bank connection management.
 *
 * Allows authorized users to connect bank accounts via Plaid Link,
 * view connected accounts and balances, trigger manual syncs,
 * and browse synced transactions.
 *
 * Consent modal gates Plaid Link — users must accept the data sharing
 * agreement before a link token is issued.
 */

import { useState, useCallback, useEffect } from "react";
import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { usePlaidLink } from "react-plaid-link";
import {
  isOAuthReturn, restoreLinkToken, storeLinkToken, clearLinkToken,
  cleanOAuthParams, sanitizePlaidExitError, PLAID_OAUTH_PATH,
} from "@/lib/plaid-oauth";
import { Link } from "wouter";
import {
  institutionColor,
  formatRelativeTime,
  totalAvailableCash,
} from "@/lib/banking-utils";
import { formatCurrency } from "@/lib/format";

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = "/api";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json.data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaidAccount {
  plaidAccountId: string;
  plaidItemId: string;
  name: string | null;
  officialName: string | null;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string;
  status: string;
  institutionName: string | null;
  lastSyncAt: string | null;
  institutionLogo: string | null;
  institutionPrimaryColor: string | null;
}

interface BankTransaction {
  id: string;
  accountId: string;
  name: string | null;
  merchantName: string | null;
  amount: number | null;
  isoCurrencyCode: string;
  date: string;
  pending: boolean;
  personalFinanceCategory: { primary: string; detailed: string } | null;
  paymentChannel: string | null;
}

interface SyncSummary {
  added: number;
  modified: number;
  removed: number;
}

interface ConsentInfo {
  policyVersion: string;
  consentText: string;
  consentTextHash: string;
}

// ─── Consent Modal ────────────────────────────────────────────────────────────

function ConsentModal({
  entitySlug,
  onConsented,
  onCancel,
}: {
  entitySlug: string;
  onConsented: () => void;
  onCancel: () => void;
}) {
  const [consentInfo, setConsentInfo] = useState<ConsentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ConsentInfo>("/plaid/consent-info")
      .then(setConsentInfo)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load consent"))
      .finally(() => setLoading(false));
  }, []);

  const handleAgree = useCallback(async () => {
    if (!consentInfo) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/plaid/consent", { entitySlug });
      onConsented();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record consent");
    } finally {
      setSubmitting(false);
    }
  }, [consentInfo, entitySlug, onConsented]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Bank Account Data Sharing Agreement</h2>

        {loading ? (
          <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
        ) : (
          <>
            <div className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-100">
              {consentInfo?.consentText ?? ""}
            </div>

            {consentInfo && (
              <p className="text-xs text-gray-400">
                Policy version: {consentInfo.policyVersion}
              </p>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onCancel}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                           hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAgree()}
                disabled={submitting || !consentInfo}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                           hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Recording…" : "I Agree"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Plaid Link wrapper (consent-gated, OAuth-safe) ──────────────────────────
//
// OAuth flow (Chase, Wells Fargo, etc.):
//  1. User clicks Connect → fetchLinkToken → saved to sessionStorage → open()
//  2. User selects Chase → Plaid redirects to Chase OAuth (page navigates away)
//  3. Chase redirects back to APP_PUBLIC_URL/accounting/banking?oauth_state_id=XXX
//  4. Component mounts → isOAuthReturn() true → restoreLinkToken() from sessionStorage
//  5. usePlaidLink receives receivedRedirectUri=window.location.href → resumes Link
//  6. onSuccess → exchange token → clearLinkToken() → cleanOAuthParams()

function PlaidLinkButton({
  entitySlug,
  onSuccess,
}: {
  entitySlug: string;
  onSuccess: () => void;
}) {
  const oauthReturn = isOAuthReturn();

  // On OAuth return, seed state from sessionStorage (survives page reload).
  // On fresh start, start null and fetch on button click.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    oauthReturn ? restoreLinkToken() : null,
  );
  const [showConsent, setShowConsent] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ linkToken: string }>("/plaid/link-token", { entitySlug });
      storeLinkToken(data.linkToken);
      setLinkToken(data.linkToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initialize Plaid Link";
      if (msg.includes("Consent required") || msg.includes("CONSENT_REQUIRED")) {
        setShowConsent(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [entitySlug]);

  const handleConsentGranted = useCallback(() => {
    setShowConsent(false);
    void fetchLinkToken();
  }, [fetchLinkToken]);

  // On OAuth return, the full current URL (with oauth_state_id) must be passed
  // so Plaid Link knows to resume the OAuth flow rather than starting fresh.
  const receivedRedirectUri = oauthReturn ? window.location.href : undefined;

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    receivedRedirectUri,

    onSuccess: async (publicToken, metadata) => {
      clearLinkToken();
      cleanOAuthParams();
      try {
        await apiPost("/plaid/exchange-token", { entitySlug, publicToken, metadata });
        setLinkToken(null);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect bank account");
      }
    },

    onExit: (err, _metadata) => {
      // Surface a sanitized message — never raw Plaid error payloads
      const msg = sanitizePlaidExitError(err);
      if (msg) setError(msg);
      // Clear token and storage so the next click starts a fresh session
      clearLinkToken();
      setLinkToken(null);
      // Remove OAuth params so a subsequent normal click works correctly
      if (oauthReturn) cleanOAuthParams();
    },

    onEvent: (eventName, metadata) => {
      // Safe diagnostics only — no credentials, phone numbers, or account numbers
      const safe = {
        event:       eventName,
        institution: (metadata as Record<string, unknown>)?.["institution_name"],
        institutionId: (metadata as Record<string, unknown>)?.["institution_id"],
        errorCode:   (metadata as Record<string, unknown>)?.["error_code"],
      };
      console.info("[Plaid Link]", safe);
    },
  });

  // Auto-open when token is ready — covers both fresh and OAuth-return paths
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  // OAuth return with no stored token — session expired before redirect
  useEffect(() => {
    if (oauthReturn && !linkToken) {
      setError("Bank connection session expired. Please click Connect bank account to try again.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showConsent && (
        <ConsentModal
          entitySlug={entitySlug}
          onConsented={handleConsentGranted}
          onCancel={() => setShowConsent(false)}
        />
      )}

      <div className="flex flex-col items-start gap-2">
        <button
          onClick={() => void fetchLinkToken()}
          disabled={loading || (oauthReturn && Boolean(linkToken))}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                     bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Initializing…
            </>
          ) : (
            <>
              <span>+</span> Connect bank account
            </>
          )}
        </button>
        {error && (
          <p className="text-xs text-red-600" role="alert">{error}</p>
        )}
      </div>
    </>
  );
}



// ─── Institution avatar ─────────────────────────────────────────────────────────────
// Local initial-letter fallback — not a Plaid logo. (institutionsGet is not
// called during exchange; only institution_id/name are stored in plaid_items.)

function InstitutionAvatar({
  name,
  logo,
  primaryColor,
}: {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { bg, text } = institutionColor(name);
  const showLogo = Boolean(logo) && !imgFailed;

  if (showLogo) {
    return (
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center
                   flex-shrink-0 bg-white overflow-hidden"
        style={primaryColor ? { boxShadow: `0 0 0 1.5px ${primaryColor}40` } : undefined}
      >
        <img
          src={logo ?? ""}
          alt={`${name} logo`}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                 flex-shrink-0 select-none"
      style={{ backgroundColor: bg, color: text }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Account card ───────────────────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: PlaidAccount }) {
  const instName = account.institutionName ?? "Bank";

  return (
    <Link
      href={`/accounting/banking/accounts/${account.plaidAccountId}`}
      className="group block bg-white rounded-xl border border-gray-200 shadow-sm
                 hover:shadow-md hover:border-gray-300 transition-all duration-150
                 no-underline focus:outline-none focus:ring-2 focus:ring-blue-500/40
                 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
        <InstitutionAvatar
          name={instName}
          logo={account.institutionLogo}
          primaryColor={account.institutionPrimaryColor}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">{instName}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                account.status === "active" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span
              className={`text-xs ${
                account.status === "active"
                  ? "text-gray-400"
                  : "text-red-500 capitalize"
              }`}
            >
              {account.status === "active" ? "Connected" : account.status}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-3 pb-2">
        <div className="text-base font-semibold text-gray-900 truncate">
          {account.name ?? "Account"}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {account.mask && (
            <span className="text-xs text-gray-400 font-mono tracking-widest">
              ···{account.mask}
            </span>
          )}
          <span className="text-xs text-gray-500 capitalize">
            {account.subtype ?? account.type ?? "Account"}
          </span>
        </div>
      </div>

      <div className="px-5 pb-3">
        <div className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
          {account.currentBalance != null
            ? formatCurrency(account.currentBalance)
            : "—"}
        </div>
        <div className="text-xs text-gray-500 mt-1">Current balance</div>
        {account.availableBalance != null && (
          <div className="text-xs text-gray-400 mt-1">
            Available:{" "}
            <span className="tabular-nums font-medium text-gray-600">
              {formatCurrency(account.availableBalance)}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {account.lastSyncAt
            ? `Synced ${formatRelativeTime(account.lastSyncAt)}`
            : "Not yet synced"}
        </div>
        <div
          className="text-xs font-medium text-blue-600 flex items-center gap-1
                      group-hover:text-blue-700 transition-colors"
        >
          View transactions →
        </div>
      </div>
    </Link>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────────────────────

function BankingSummary({ accounts }: { accounts: PlaidAccount[] }) {
  if (accounts.length === 0) return null;
  const cash = totalAvailableCash(accounts);
  const latestSync = accounts
    .map((a) => a.lastSyncAt)
    .filter((s): s is string => s != null)
    .sort()
    .at(-1);
  const stats: { label: string; value: string; sub: string }[] = [
    {
      label: "Connected Accounts",
      value: String(accounts.length),
      sub: accounts.length === 1 ? "account" : "accounts",
    },
    {
      label: "Available Cash",
      value: formatCurrency(cash),
      sub: "Depository accounts only",
    },
    {
      label: "Last Synced",
      value: latestSync ? formatRelativeTime(latestSync) : "—",
      sub: "Across all accounts",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(({ label, value, sub }) => (
        <div
          key={label}
          className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
        >
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {label}
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1 tabular-nums truncate">
            {value}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────────────────────

export default function AccountingBankingPage() {
  const { activeSlug } = useAccountingEntity();
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!activeSlug) return;
    setLoadingAccounts(true);
    setError(null);
    try {
      const data = await apiGet<PlaidAccount[]>(
        `/plaid/accounts?entitySlug=${encodeURIComponent(activeSlug)}`,
      );
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }, [activeSlug]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  return (
    <AccountingLayout
      title="Bank Accounts"
      subtitle="Plaid-connected bank and credit accounts"
    >
      <div className="space-y-6">
        {/* Connection controls — PlaidLinkButton preserved byte-for-byte */}
        <div className="flex items-center justify-between">
          <PlaidLinkButton
            entitySlug={activeSlug}
            onSuccess={() => void loadAccounts()}
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loadingAccounts && <BankingSummary accounts={accounts} />}

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Connected Accounts
          </h2>
          {loadingAccounts ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Loading accounts…
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
              <div className="text-sm font-medium text-gray-500">No connected accounts</div>
              <div className="text-xs text-gray-400 mt-1">
                Click “Connect bank account” above to link your first institution.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {accounts.map((account) => (
                <AccountCard key={account.plaidAccountId} account={account} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountingLayout>
  );
}
