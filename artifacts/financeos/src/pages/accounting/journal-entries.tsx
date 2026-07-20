import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { AlertCircle } from "lucide-react";

export default function JournalEntriesPage() {
  return (
    <AccountingLayout title="Journal Entries" subtitle="Manual entries and adjustments">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Journal entries not available</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Manual journal entries require a FinanceOS-native double-entry accounting engine.
            QBO journal entries are not yet surfaced in the FinanceOS Core pipeline.
            This feature is planned for a future release.
          </p>
          <p className="text-[12px] text-gray-400 mt-3">
            Data source requirement: <code className="bg-gray-100 px-1 rounded text-[11px]">journal_entries</code> table
            or QBO journal entry sync — neither currently available in the Core pipeline.
          </p>
        </div>
      </div>
    </AccountingLayout>
  );
}
