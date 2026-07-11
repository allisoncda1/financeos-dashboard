import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton, MiniKpi } from "@/components/accounting/AccountingUI";
import { CATEGORIZATION_RULES } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

export default function RulesPage() {
  const activeCount = CATEGORIZATION_RULES.filter(r => r.active).length;
  const totalApplied = CATEGORIZATION_RULES.reduce((s, r) => s + r.applied, 0);

  return (
    <AccountingLayout title="Categorization Rules" subtitle="Automate transaction categorization">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Active rules" value={String(activeCount)} sub={`${CATEGORIZATION_RULES.length} total rules`} tone="emerald" />
        <MiniKpi label="Transactions auto-categorized" value={String(totalApplied)} sub="All time" tone="blue" />
        <MiniKpi label="Auto-approval accuracy" value="95%" sub="Last 30 days" tone="gray" />
      </div>

      <Card
        title="Rules"
        action={<PrimaryButton testId="button-new-rule"><Plus className="w-3.5 h-3.5" /> New Rule</PrimaryButton>}
      >
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
      </Card>
    </AccountingLayout>
  );
}
