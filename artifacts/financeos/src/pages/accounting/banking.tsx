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

// ─── Accounts table ───────────────────────────────────────────────────────────

function AccountsTable({
  accounts,
  onSync,
  syncingItemId,
}: {
  accounts: PlaidAccount[];
  onSync: (plaidItemId: string) => void;
  syncingItemId: string | null;
}) {
  if (accounts.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-gray-400">
        No connected accounts. Click "Connect bank account" to link your first institution.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Institution</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Sync</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {accounts.map((acct) => {
            const syncing = syncingItemId === acct.plaidItemId;
            return (
              <tr key={acct.plaidAccountId} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-900">
                  {acct.institutionName ?? "—"}
                </td>
                <td className="px-5 py-3 text-gray-700">
                  {acct.name ?? "—"}
                  {acct.mask && (
                    <span className="ml-1 text-gray-400 font-mono text-xs">···{acct.mask}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600 capitalize">
                  {acct.subtype ?? acct.type ?? "—"}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-900">
                  {acct.currentBalance != null
                    ? formatCurrency(acct.currentBalance)
                    : "—"}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-gray-600">
                  {acct.availableBalance != null
                    ? formatCurrency(acct.availableBalance)
                    : "—"}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {acct.lastSyncAt
                    ? new Date(acct.lastSyncAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-5 py-3">
                  <Pill
                    tone={
                      acct.status === "active"
                        ? "emerald"
                        : acct.status === "error"
                        ? "red"
                        : "gray"
                    }
                  >
                    {acct.status}
                  </Pill>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => onSync(acct.plaidItemId)}
                    disabled={syncing}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400
                               disabled:cursor-not-allowed font-medium"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Transactions table ───────────────────────────────────────────────────────

function TransactionsTable({ transactions }: { transactions: BankTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-gray-400">
        No transactions found. Connect a bank account and sync to populate.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Merchant / Name</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {transactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-gray-50/50">
              <td className="px-5 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">
                {txn.date}
              </td>
              <td className="px-5 py-3 text-gray-900 font-medium">
                {txn.merchantName ?? txn.name ?? "—"}
              </td>
              <td className="px-5 py-3 text-gray-500 text-xs">
                {txn.personalFinanceCategory?.detailed
                  ?.replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—"}
              </td>
              <td className="px-5 py-3 text-gray-500 text-xs capitalize">
                {txn.paymentChannel ?? "—"}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                <span className={txn.amount != null && txn.amount > 0 ? "text-red-600" : "text-emerald-700"}>
                  {txn.amount != null ? formatCurrency(Math.abs(txn.amount)) : "—"}
                </span>
              </td>
              <td className="px-5 py-3">
                {txn.pending ? (
                  <Pill tone="amber">Pending</Pill>
                ) : (
                  <Pill tone="emerald">Posted</Pill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountingBankingPage() {
  const { activeSlug } = useAccountingEntity();

  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!activeSlug) return;
    setLoadingAccounts(true);
    setError(null);
    try {
      const data = await apiGet<PlaidAccount[]>(`/plaid/accounts?entitySlug=${encodeURIComponent(activeSlug)}`);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }, [activeSlug]);

  const loadTransactions = useCallback(async () => {
    if (!activeSlug) return;
    setLoadingTransactions(true);
    try {
      const data = await apiGet<{ transactions: BankTransaction[]; pagination: unknown }>(
        `/plaid/transactions?entitySlug=${encodeURIComponent(activeSlug)}&limit=50`,
      );
      setTransactions(data.transactions);
    } catch {
      // Non-fatal — transactions may be empty on first connect
    } finally {
      setLoadingTransactions(false);
    }
  }, [activeSlug]);

  const handleSync = useCallback(async (plaidItemId: string) => {
    setSyncingItemId(plaidItemId);
    setError(null);
    try {
      const summary = await apiPost<SyncSummary>(`/plaid/items/${plaidItemId}/sync`, {});
      setLastSyncSummary(summary);
      await Promise.all([loadAccounts(), loadTransactions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingItemId(null);
    }
  }, [loadAccounts, loadTransactions]);

  const handleLinkSuccess = useCallback(async () => {
    await Promise.all([loadAccounts(), loadTransactions()]);
  }, [loadAccounts, loadTransactions]);

  // Load on mount and when entity changes
  useEffect(() => {
    void loadAccounts();
    void loadTransactions();
  }, [loadAccounts, loadTransactions]);

  return (
    <AccountingLayout
      title="Bank Accounts"
      subtitle="Plaid-connected bank and credit accounts"
    >
      <div className="space-y-6">
        {/* Connect button + status */}
        <div className="flex items-center justify-between">
          <PlaidLinkButton entitySlug={activeSlug} onSuccess={handleLinkSuccess} />
          {lastSyncSummary && (
            <p className="text-xs text-gray-500">
              Last sync: +{lastSyncSummary.added} added, {lastSyncSummary.modified} modified,{" "}
              {lastSyncSummary.removed} removed
            </p>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Connected accounts */}
        <Card title="Connected Accounts">
          {loadingAccounts ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading accounts…</div>
          ) : (
            <AccountsTable
              accounts={accounts}
              onSync={handleSync}
              syncingItemId={syncingItemId}
            />
          )}
        </Card>

        {/* Transactions */}
        <Card title="Recent Transactions">
          {loadingTransactions ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading transactions…</div>
          ) : (
            <TransactionsTable transactions={transactions} />
          )}
        </Card>
      </div>
    </AccountingLayout>
  );
}
