/**
 * Account detail — transactions scoped to a single Plaid account.
 * Route: /accounting/banking/accounts/:accountId
 *
 * Transactions are filtered server-side (?accountId=) AND client-side so
 * another account's records cannot appear regardless of API response shape.
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { useAccountingEntity } from "@/lib/accounting-context";
import { formatCurrency } from "@/lib/format";
import { institutionColor, formatRelativeTime } from "@/lib/banking-utils";

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = "/api";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json.data as T;
}

// ─── Types (structural duplicate of banking.tsx — avoids cross-page import) ──

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

// ─── Transaction row ──────────────────────────────────────────────────────────

function InstitutionAvatar({
  name,
  logo,
  primaryColor,
  size = "sm",
}: {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  size?: "sm" | "lg";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const { bg, text } = institutionColor(name);
  const cls =
    size === "lg"
      ? "w-12 h-12 rounded-xl text-lg"
      : "w-9 h-9 rounded-lg text-sm";
  const showLogo = Boolean(logo) && !imgFailed;

  if (showLogo) {
    return (
      <span
        className={`${cls} flex items-center justify-center flex-shrink-0 bg-white overflow-hidden`}
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
      className={`${cls} flex items-center justify-center font-bold flex-shrink-0 select-none`}
      style={{ backgroundColor: bg, color: text }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function TransactionRow({ txn }: { txn: BankTransaction }) {
  const isDebit = txn.amount != null && txn.amount > 0;
  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-5 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">
        {txn.date}
      </td>
      <td className="px-5 py-3 text-gray-900 font-medium text-sm">
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
      <td className="px-5 py-3 text-right tabular-nums font-medium text-sm">
        <span className={isDebit ? "text-red-600" : "text-emerald-700"}>
          {isDebit ? "−" : "+"}
          {txn.amount != null ? formatCurrency(Math.abs(txn.amount)) : "—"}
        </span>
      </td>
      <td className="px-5 py-3 text-xs">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
            txn.pending
              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          }`}
        >
          {txn.pending ? "Pending" : "Posted"}
        </span>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BankingAccountPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId ?? "";
  const { activeSlug } = useAccountingEntity();

  const [account, setAccount] = useState<PlaidAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!activeSlug || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const [accountsData, txData] = await Promise.all([
        apiGet<PlaidAccount[]>(
          `/plaid/accounts?entitySlug=${encodeURIComponent(activeSlug)}`,
        ),
        apiGet<{ transactions: BankTransaction[]; pagination: unknown }>(
          `/plaid/transactions?entitySlug=${encodeURIComponent(activeSlug)}&accountId=${encodeURIComponent(accountId)}&limit=100`,
        ),
      ]);
      setAccount(accountsData.find((a) => a.plaidAccountId === accountId) ?? null);
      // Client-side double-filter: API already scopes by accountId; enforce
      // here so no other account's records can render regardless of shape.
      setTransactions(txData.transactions.filter((t) => t.accountId === accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [activeSlug, accountId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const instName = account?.institutionName ?? "Bank";

  return (
    <AccountingLayout
      title={account?.name ?? "Account"}
      subtitle={
        account
          ? `${instName} · ${account.subtype ?? account.type ?? "Account"}`
          : "Loading…"
      }
    >
      <div className="space-y-6">
        <div>
          <Link
            href="/accounting/banking"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500
                       hover:text-gray-800 transition-colors no-underline"
          >
            ← Bank Accounts
          </Link>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading account…</div>
        ) : account == null ? (
          <div className="py-16 text-center text-sm text-gray-500">Account not found.</div>
        ) : (
          <>
            {/* Identity + balances */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100">
                <InstitutionAvatar
                  name={instName}
                  logo={account.institutionLogo}
                  primaryColor={account.institutionPrimaryColor}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 truncate">
                      {account.name ?? "Account"}
                    </h2>
                    {account.mask && (
                      <span className="text-sm text-gray-400 font-mono">
                        ···{account.mask}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {instName} ·{" "}
                    <span className="capitalize">
                      {account.subtype ?? account.type ?? "Account"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-gray-100">
                <div className="px-6 py-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Current Balance
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                    {account.currentBalance != null
                      ? formatCurrency(account.currentBalance)
                      : "—"}
                  </div>
                </div>
                {account.availableBalance != null && (
                  <div className="px-6 py-4">
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                      Available Balance
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                      {formatCurrency(account.availableBalance)}
                    </div>
                  </div>
                )}
                <div className="px-6 py-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Last Synced
                  </div>
                  <div className="text-base font-semibold text-gray-900 mt-1">
                    {account.lastSyncAt ? formatRelativeTime(account.lastSyncAt) : "Never"}
                  </div>
                </div>
              </div>
            </div>

            {/* Account-scoped transactions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Transactions
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {transactions.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="text-sm font-medium text-gray-500">No transactions found</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Transactions will appear here after the next sync.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {(["Date", "Merchant / Name", "Category", "Channel", "Amount", "Status"] as const).map(
                            (h) => (
                              <th
                                key={h}
                                className={`px-5 py-3 text-xs font-semibold text-gray-500
                                           uppercase tracking-wider ${
                                             h === "Amount" ? "text-right" : "text-left"
                                           }`}
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {transactions.map((txn) => (
                          <TransactionRow key={txn.id} txn={txn} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AccountingLayout>
  );
}
