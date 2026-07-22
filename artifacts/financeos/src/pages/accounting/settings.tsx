import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingAccounts } from "@/hooks/useApi";
import { Landmark, CreditCard, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-semibold text-gray-900">{value}</span>
    </div>
  );
}

const ACCOUNT_ICONS = [Landmark, PiggyBank, CreditCard];

export default function AccountingSettingsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: accounts } = useAccountingAccounts(activeSlug);

  const bankAccounts = (accounts ?? []).filter(a => a.accountType === "Bank" && a.isActive);

  return (
    <AccountingLayout title="Accounting Settings" subtitle="Company, preferences, and automation">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Company Information">
          <div className="px-5 py-4 text-[12px] text-gray-400 italic">
            Company details are managed in QBO. Entity configuration will be surfaced here in a future release.
          </div>
        </Card>

        <Card title="Accounting Preferences">
          <Row label="Fiscal year start" value="January" />
          <Row label="Accounting basis" value="Accrual" />
          <Row label="Close frequency" value="Monthly" />
          <Row label="Default AR terms" value="Net 14" />
          <Row label="Default AP terms" value="Net 30" />
        </Card>

        <Card title="Bank Connections">
          {bankAccounts.length === 0 ? (
            <div className="px-5 py-4 text-[12px] text-gray-400">
              {accounts === undefined
                ? "Loading bank accounts…"
                : "No active bank accounts found for this entity."}
            </div>
          ) : (
            bankAccounts.map((acc, i) => {
              const Icon = ACCOUNT_ICONS[i] ?? Landmark;
              return (
                <div key={acc.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-b-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900">{acc.name}</p>
                    <p className="text-[11px] text-gray-400">Balance {fmt(acc.currentBalance)}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    Synced
                  </span>
                </div>
              );
            })
          )}
        </Card>

        <Card title="Automation">
          <div className="px-5 py-4 text-[12px] text-gray-400 italic">
            Automation settings are managed in QBO. FinanceOS automation rules will be configurable here in a future release.
          </div>
        </Card>
      </div>
    </AccountingLayout>
  );
}
