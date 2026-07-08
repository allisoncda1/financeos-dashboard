import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { TRANSACTIONS, CATEGORIZED_TRANSACTIONS, CATEGORIZATION_RULES } from "@/lib/accountingMockData";
import { Link } from "wouter";
import { Plus, MoreVertical } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const VIEWS = [
  { id: "uncategorized", label: "Uncategorized" },
  { id: "categorized", label: "Categorized" },
  { id: "rules", label: "Rules" },
];

export default function TransactionsPage({ view = "uncategorized" }: { view?: string }) {
  const activeView = VIEWS.find(v => v.id === view) ?? VIEWS[0];

  return (
    <AccountingLayout title="Bank Transactions" subtitle="Import, categorize, and review bank activity">
      <Card title="Bank Transactions">
        <div className="px-5 pt-3 border-b border-gray-100">
          <div className="flex gap-6">
            {VIEWS.map(v => (
              <Link
                key={v.id}
                href={`/accounting/transactions/${v.id}`}
                data-testid={`tab-transactions-view-${v.id}`}
                className={`pb-3 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeView.id === v.id
                    ? "border-emerald-500 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>

        {activeView.id === "uncategorized" && (
          <DataTable headers={[
            { label: "Date" }, { label: "Description" }, { label: "Account" },
            { label: "Suggested Category" }, { label: "Confidence" },
            { label: "Amount", className: "text-right" }, { label: "" },
          ]}>
            {TRANSACTIONS.map(tx => (
              <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="hover:bg-gray-50 transition-colors">
                <Td>{tx.date}</Td>
                <Td className="font-medium text-gray-900 text-[13px]">{tx.description}</Td>
                <Td className="text-gray-500">{tx.account}</Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tx.categoryColor}`}>
                    {tx.suggestedCategory}
                  </span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-600">
                    <span className={`w-1.5 h-1.5 rounded-full ${tx.confidenceColor}`} />
                    {tx.confidence}%
                  </span>
                </Td>
                <Td className="text-right font-semibold text-gray-900">{fmt(tx.amount)}</Td>
                <Td className="w-10">
                  <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}

        {activeView.id === "categorized" && (
          <DataTable headers={[
            { label: "Date" }, { label: "Description" }, { label: "Account" },
            { label: "Category" }, { label: "Reviewed" },
            { label: "Amount", className: "text-right" },
          ]}>
            {CATEGORIZED_TRANSACTIONS.map(tx => (
              <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="hover:bg-gray-50 transition-colors">
                <Td>{tx.date}</Td>
                <Td className="font-medium text-gray-900 text-[13px]">{tx.description}</Td>
                <Td className="text-gray-500">{tx.account}</Td>
                <Td><Pill tone={tx.categoryTone}>{tx.category}</Pill></Td>
                <Td>
                  {tx.reviewed
                    ? <Pill tone="emerald">Reviewed</Pill>
                    : <Pill tone="amber">Pending</Pill>}
                </Td>
                <Td className={`text-right font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-gray-900"}`}>
                  {fmt(tx.amount)}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}

        {activeView.id === "rules" && (
          <>
            <div className="px-5 py-3 flex justify-end border-b border-gray-100">
              <PrimaryButton testId="button-new-rule"><Plus className="w-3.5 h-3.5" /> New Rule</PrimaryButton>
            </div>
            <DataTable headers={[
              { label: "Rule" }, { label: "Condition" }, { label: "Category" },
              { label: "Applied", className: "text-right" }, { label: "Status" },
            ]}>
              {CATEGORIZATION_RULES.map(rule => (
                <tr key={rule.id} data-testid={`row-rule-${rule.id}`} className="hover:bg-gray-50 transition-colors">
                  <Td className="font-semibold text-gray-900 text-[13px]">{rule.name}</Td>
                  <Td className="text-gray-500 whitespace-normal">{rule.condition}</Td>
                  <Td><Pill tone={rule.categoryTone}>{rule.category}</Pill></Td>
                  <Td className="text-right">{rule.applied}</Td>
                  <Td>{rule.active ? <Pill tone="emerald">Active</Pill> : <Pill tone="gray">Paused</Pill>}</Td>
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </Card>
    </AccountingLayout>
  );
}
