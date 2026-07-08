import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, Pill } from "@/components/accounting/AccountingUI";
import { BANK_ACCOUNTS } from "@/lib/accountingMockData";
import { Landmark, CreditCard, PiggyBank } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

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
  return (
    <AccountingLayout title="Accounting Settings" subtitle="Company, preferences, and automation">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Company Information">
          <Row label="Legal name" value="T3 Marketing LLC" />
          <Row label="EIN" value="82-4471936" />
          <Row label="Entity type" value="LLC" />
          <Row label="Address" value="418 Commerce St, Austin, TX" />
          <Row label="Primary currency" value="USD" />
        </Card>

        <Card title="Accounting Preferences">
          <Row label="Fiscal year start" value="January" />
          <Row label="Accounting basis" value="Accrual" />
          <Row label="Close frequency" value="Monthly" />
          <Row label="Default AR terms" value="Net 14" />
          <Row label="Default AP terms" value="Net 30" />
        </Card>

        <Card title="Bank Connections">
          {BANK_ACCOUNTS.map((acc, i) => {
            const Icon = ACCOUNT_ICONS[i] ?? Landmark;
            return (
              <div key={acc.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-b-0">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900">{acc.name}</p>
                  <p className="text-[11px] text-gray-400">Balance {fmt(acc.balance)}</p>
                </div>
                <Pill tone="emerald">{acc.status}</Pill>
              </div>
            );
          })}
        </Card>

        <Card title="Automation">
          <Row label="Auto-categorization" value="Enabled" />
          <Row label="Auto-approve threshold" value="95% confidence" />
          <Row label="Duplicate detection" value="Enabled" />
          <Row label="Daily bank sync" value="9:00 AM CT" />
          <Row label="Recurring invoice automation" value="Enabled" />
        </Card>
      </div>
    </AccountingLayout>
  );
}
