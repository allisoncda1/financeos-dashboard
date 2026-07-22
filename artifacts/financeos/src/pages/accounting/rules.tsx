import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { AlertCircle } from "lucide-react";

export default function RulesPage() {
  return (
    <AccountingLayout title="Categorization Rules" subtitle="Automate transaction categorization">
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-8 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Categorization rules engine not configured</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Transaction categorization rules require a rule engine that matches transaction patterns
            (payee name, memo, amount range) to GL accounts. This is a FinanceOS-native feature
            that does not exist in QBO's data model and must be built as a separate service.
            This feature is planned for a future release.
          </p>
          <p className="text-[12px] text-gray-400 mt-3">
            Data source requirement: FinanceOS categorization rules engine (operational DB table
            <code className="bg-gray-100 px-1 rounded text-[11px] ml-1">categorization_rules</code>) — not yet implemented.
          </p>
        </div>
      </div>
    </AccountingLayout>
  );
}
