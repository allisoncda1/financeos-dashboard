import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { JOURNAL_ENTRIES } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function JournalEntriesPage() {
  return (
    <AccountingLayout title="Journal Entries" subtitle="Manual entries and adjustments">
      <Card
        title="Journal Entries"
        action={<PrimaryButton testId="button-new-journal-entry"><Plus className="w-3.5 h-3.5" /> New Entry</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Date" }, { label: "Ref" }, { label: "Memo" },
          { label: "Debit", className: "text-right" }, { label: "Credit", className: "text-right" },
          { label: "Status" },
        ]}>
          {JOURNAL_ENTRIES.map(je => (
            <tr key={je.id} data-testid={`row-journal-${je.ref}`} className="hover:bg-gray-50 transition-colors">
              <Td>{je.date}</Td>
              <Td className="font-semibold text-gray-900 text-[13px]">{je.ref}</Td>
              <Td className="text-gray-500 whitespace-normal">{je.memo}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(je.debit)}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(je.credit)}</Td>
              <Td>
                {je.status === "Posted"
                  ? <Pill tone="emerald">Posted</Pill>
                  : <Pill tone="gray">Draft</Pill>}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
