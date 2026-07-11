import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { CHART_OF_ACCOUNTS } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const TYPE_TONE: Record<string, string> = {
  Asset: "blue",
  Liability: "amber",
  Equity: "purple",
  Income: "emerald",
  Expense: "rose",
};

export default function ChartOfAccountsPage() {
  return (
    <AccountingLayout title="Chart of Accounts" subtitle="Your account structure and balances">
      <Card
        title="Chart of Accounts"
        action={<PrimaryButton testId="button-new-account"><Plus className="w-3.5 h-3.5" /> New Account</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Code" }, { label: "Account" }, { label: "Type" },
          { label: "Balance", className: "text-right" },
        ]}>
          {CHART_OF_ACCOUNTS.map(a => (
            <tr key={a.code} data-testid={`row-account-${a.code}`} className="hover:bg-gray-50 transition-colors">
              <Td className="text-gray-400 font-mono text-[12px]">{a.code}</Td>
              <Td className="font-semibold text-gray-900 text-[13px]">{a.name}</Td>
              <Td><Pill tone={TYPE_TONE[a.type]}>{a.type}</Pill></Td>
              <Td className={`text-right font-semibold ${a.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                {fmt(a.balance)}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
