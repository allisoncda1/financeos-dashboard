import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingAccounts } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

const TYPE_TONE: Record<string, string> = {
  Bank: "blue",
  "Credit Card": "amber",
  Asset: "blue",
  Liability: "amber",
  Equity: "purple",
  Income: "emerald",
  Expense: "rose",
  "Other Current Asset": "blue",
  "Other Current Liability": "amber",
  "Fixed Asset": "blue",
  "Long Term Liability": "amber",
  "Other Income": "emerald",
  "Cost of Goods Sold": "rose",
};

export default function ChartOfAccountsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: accounts, source } = useAccountingAccounts(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !accounts)) {
    return (
      <AccountingLayout title="Chart of Accounts" subtitle="Account structure and balances from QBO">
        <p className="text-sm text-gray-400">Loading chart of accounts…</p>
      </AccountingLayout>
    );
  }

  if (!accounts) {
    return (
      <AccountingLayout title="Chart of Accounts" subtitle="Account structure and balances from QBO">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Chart of accounts unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  return (
    <AccountingLayout title="Chart of Accounts" subtitle="Account structure and balances from QBO">
      <Card title={`Chart of Accounts — ${accounts.length} accounts`}>
        <DataTable headers={[
          { label: "Account" }, { label: "Type" }, { label: "Subtype" },
          { label: "Balance", className: "text-right" },
        ]}>
          {accounts.map(a => (
            <tr key={a.id} data-testid={`row-account-${a.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className={`font-semibold text-gray-900 text-[13px] ${a.isSubAccount ? "pl-8" : ""}`}>
                {a.name ?? "—"}
              </Td>
              <Td>
                <Pill tone={TYPE_TONE[a.accountType ?? ""] ?? "gray"}>
                  {a.accountType ?? "—"}
                </Pill>
              </Td>
              <Td className="text-gray-500 text-[12px]">{a.accountSubtype ?? "—"}</Td>
              <Td className={`text-right font-semibold ${a.currentBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
                {fmt(a.currentBalance)}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
