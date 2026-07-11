import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { CLOSE_TASKS } from "@/lib/accountingMockData";
import { Lock } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  Complete: "emerald",
  "In Progress": "amber",
  "Not Started": "gray",
};

export default function MonthEndClosePage() {
  const complete = CLOSE_TASKS.filter(t => t.status === "Complete").length;
  const pct = Math.round((complete / CLOSE_TASKS.length) * 100);

  return (
    <AccountingLayout title="Month-End Close" subtitle="June 2026 close checklist">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">June 2026 close progress</p>
            <p className="text-[22px] font-bold text-gray-900 leading-tight">
              {complete} of {CLOSE_TASKS.length} tasks complete
            </p>
          </div>
          <PrimaryButton testId="button-close-month"><Lock className="w-3.5 h-3.5" /> Close Month</PrimaryButton>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{pct}% complete · Target close date Jul 10, 2026</p>
      </div>

      <Card title="Close Checklist">
        <DataTable headers={[
          { label: "Task" }, { label: "Owner" }, { label: "Status" },
        ]}>
          {CLOSE_TASKS.map(t => (
            <tr key={t.id} data-testid={`row-close-task-${t.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-medium text-gray-900 text-[13px] whitespace-normal">{t.task}</Td>
              <Td className="text-gray-500">{t.owner}</Td>
              <Td><Pill tone={STATUS_TONE[t.status]}>{t.status}</Pill></Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
