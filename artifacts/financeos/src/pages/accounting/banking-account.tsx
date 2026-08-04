/**
 * Account detail — transactions scoped to a single Plaid account.
 * Route: /accounting/banking/accounts/:accountId
 *
 * Transactions are filtered server-side (?accountId=) AND client-side so
 * another account's records cannot appear regardless of API response shape.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { useAccountingEntity } from "@/lib/accounting-context";
import { formatCurrency } from "@/lib/format";
import { institutionColor, formatRelativeTime } from "@/lib/banking-utils";
import { api } from "@/lib/api";
import type {
  AccountingAccount,
  BankingTransactionCategoryMap,
  HistoricalQboCategory,
  HistoricalQboCategoryMap,
} from "@/lib/api";

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

function TransactionRow({
  txn,
  category,
  historicalCategory,
  onEdit,
}: {
  txn: BankTransaction;
  category: import("@/lib/api").BankingTransactionCategory | undefined;
  historicalCategory: HistoricalQboCategory | undefined;
  onEdit: (tx: BankTransaction) => void;
}) {
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
      <td className="px-5 py-3 text-xs">
        <button
          onClick={() => onEdit(txn)}
          className={`inline-flex flex-col items-start rounded-lg px-2 py-1 text-left font-medium ring-1 transition-colors ${
            category
              ? "bg-blue-50 text-blue-700 ring-blue-200 hover:bg-blue-100"
              : historicalCategory
                ? "bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100"
                : "bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100"
          }`}
        >
          {category ? (
            <span>{category.coaAccountName ?? category.coaAccountId}</span>
          ) : historicalCategory ? (
            <>
              {historicalCategory.lines.map((line) => (
                <span key={line.lineIndex}>
                  {line.coaAccountName ?? line.coaAccountId ?? "QBO category"}
                  {line.qboClassName ? ` · ${line.qboClassName}` : ""}
                  {historicalCategory.lines.length > 1 && line.lineAmount != null
                    ? ` · ${formatCurrency(Math.abs(line.lineAmount))}`
                    : ""}
                </span>
              ))}
              <span className="mt-0.5 text-[10px] font-normal text-violet-500">
                Imported from QuickBooks
              </span>
            </>
          ) : (
            <span>Uncategorized</span>
          )}
        </button>
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
  const [coaAccounts, setCoaAccounts] = useState<AccountingAccount[]>([]);
  const [categoryMap, setCategoryMap] = useState<BankingTransactionCategoryMap>({});
  const [historicalCategoryMap, setHistoricalCategoryMap] =
    useState<HistoricalQboCategoryMap>({});
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [selectedCoaId, setSelectedCoaId] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "uncategorized" | "categorized">("all");
  const [coaFilter, setCoaFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!activeSlug || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const [accountsData, txData, coaData] = await Promise.all([
        apiGet<PlaidAccount[]>(
          `/plaid/accounts?entitySlug=${encodeURIComponent(activeSlug)}`,
        ),
        apiGet<{ transactions: BankTransaction[]; pagination: unknown }>(
          `/plaid/transactions?entitySlug=${encodeURIComponent(activeSlug)}&accountId=${encodeURIComponent(accountId)}&limit=100`,
        ),
        api.accountingAccounts(activeSlug),
      ]);
      setAccount(accountsData.find((a) => a.plaidAccountId === accountId) ?? null);
      // Client-side double-filter: API already scopes by accountId; enforce
      // here so no other account's records can render regardless of shape.
      const filtered = txData.transactions.filter((t) => t.accountId === accountId);
      setCoaAccounts(coaData.data);
      setTransactions(filtered);
      const transactionIds = filtered.map((t) => t.id);
      const [catMap, qboHistoryMap] = await Promise.all([
        api.bankingTransactionCategories(activeSlug, transactionIds),
        api.bankingQboHistoryCategories(activeSlug, transactionIds),
      ]);
      setCategoryMap(catMap);
      setHistoricalCategoryMap(qboHistoryMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
      setAccount(null);
      setTransactions([]);
      setCoaAccounts([]);
      setCategoryMap({});
      setHistoricalCategoryMap({});
    } finally {
      setLoading(false);
    }
  }, [activeSlug, accountId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openEditor = useCallback(
    (tx: BankTransaction) => {
      const existing = categoryMap[tx.id];
      setSelectedCoaId(existing?.coaAccountId ?? "");
      setNoteInput(existing?.note ?? "");
      setSaveError(null);
      setEditingTxId(tx.id);
    },
    [categoryMap],
  );

  const closeEditor = useCallback(() => {
    setEditingTxId(null);
    setSelectedCoaId("");
    setNoteInput("");
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeSlug || !editingTxId || !selectedCoaId || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const saved = await api.saveBankingTransactionCategory(
        activeSlug,
        editingTxId,
        {
          coaAccountId: selectedCoaId,
          note: noteInput.trim() || null,
        },
      );

      setCategoryMap((current) => ({
        ...current,
        [editingTxId]: saved,
      }));
      closeEditor();
    } catch {
      setSaveError("Unable to save this category. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    activeSlug,
    editingTxId,
    selectedCoaId,
    noteInput,
    saving,
    closeEditor,
  ]);



  const uncategorizedCount = useMemo(
    () =>
      transactions.filter(
        (t) => !categoryMap[t.id] && !historicalCategoryMap[t.id],
      ).length,
    [transactions, categoryMap, historicalCategoryMap],
  );

  const availableCoaCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of transactions) {
      const cat = categoryMap[t.id];
      if (cat) {
        seen.set(cat.coaAccountId, cat.coaAccountName ?? cat.coaAccountId);
        continue;
      }
      for (const line of historicalCategoryMap[t.id]?.lines ?? []) {
        if (line.coaAccountId) {
          seen.set(
            line.coaAccountId,
            line.coaAccountName ?? line.coaAccountId,
          );
        }
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [transactions, categoryMap, historicalCategoryMap]);

  const visibleTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const cat = categoryMap[t.id];
      const historical = historicalCategoryMap[t.id];
      const isCategorized = Boolean(cat || historical);

      if (statusFilter === "uncategorized" && isCategorized) return false;
      if (statusFilter === "categorized" && !isCategorized) return false;

      if (coaFilter) {
        const manualMatches = cat?.coaAccountId === coaFilter;
        const historicalMatches =
          !cat &&
          historical?.lines.some(
            (line) => line.coaAccountId === coaFilter,
          );
        if (!manualMatches && !historicalMatches) return false;
      }
      return true;
    });
  }, [
    transactions,
    categoryMap,
    historicalCategoryMap,
    statusFilter,
    coaFilter,
  ]);

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
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
                  <span className="text-xs text-gray-500">
                    {uncategorizedCount > 0
                      ? `${uncategorizedCount} uncategorized`
                      : "All categorized"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {visibleTransactions.length} of {transactions.length} transactions
                  </span>
                  <select
                    className="ml-auto text-xs rounded-lg border border-gray-200 px-2 py-1"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "uncategorized" | "categorized")}
                  >
                    <option value="all">All transactions</option>
                    <option value="uncategorized">Uncategorized</option>
                    <option value="categorized">Categorized</option>
                  </select>
                  <select
                    className="text-xs rounded-lg border border-gray-200 px-2 py-1"
                    value={coaFilter}
                    onChange={(e) => setCoaFilter(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {availableCoaCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {(["Date", "Merchant / Name", "Plaid Category", "FinanceOS Category", "Channel", "Amount", "Status"] as const).map(
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
                        {visibleTransactions.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-8 text-center text-sm text-gray-500"
                            >
                              No transactions match these filters.
                            </td>
                          </tr>
                        ) : visibleTransactions.map((txn) => (
                          <TransactionRow
                            key={txn.id}
                            txn={txn}
                            category={categoryMap[txn.id]}
                            historicalCategory={
                              categoryMap[txn.id]
                                ? undefined
                                : historicalCategoryMap[txn.id]
                            }
                            onEdit={openEditor}
                          />
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

      {editingTxId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Set FinanceOS Category
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Account
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={selectedCoaId}
                  onChange={(e) => setSelectedCoaId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Select an account…</option>
                  {coaAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Note{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  disabled={saving}
                  placeholder="Add a note…"
                />
              </div>
              {saveError !== null && (
                <p className="text-xs text-red-600">{saveError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={closeEditor}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void handleSave()}
                disabled={saving || !selectedCoaId}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AccountingLayout>
  );
}
