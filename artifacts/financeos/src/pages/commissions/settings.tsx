import { AlertCircle } from "lucide-react";
import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, Pill } from "@/components/accounting/AccountingUI";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export default function CommissionSettingsPage() {
  return (
    <CommissionLayout title="Settings" subtitle="Commission module configuration">
      <div
        data-testid="commission-settings-unavailable"
        className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 mb-6"
      >
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-900">
          <span className="font-semibold">Commission settings are not yet connected to a backend.</span>{" "}
          Values shown below are design placeholders and will not persist. The commission engine
          (eligibility rules, payout schedules, sync) is planned for a future release.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Calculation Settings">
          <Row label="Commission basis" value="Invoice revenue" />
          <Row label="Calculation schedule" value="1st of each month" />
          <Row label="Approval required" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Lock period after approval" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Clawback on refunds" value={<Pill tone="gray">Disabled</Pill>} />
        </Card>

        <Card title="Payout Settings">
          <Row label="Payout schedule" value="5th of each month" />
          <Row label="Payout method" value="ACH" />
          <Row label="Minimum payout" value="—" />
          <Row label="Auto-schedule payouts" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Payout notifications" value={<Pill tone="emerald">Enabled</Pill>} />
        </Card>

        <Card title="Data Sources">
          <Row label="Invoice source" value="FinanceOS Accounting" />
          <Row label="Client assignments" value="CRM sync" />
          <Row label="Sync frequency" value="—" />
          <Row label="Last sync" value="—" />
        </Card>

        <Card title="Permissions">
          <Row label="Who can approve" value="Admin, CFO" />
          <Row label="Who can run calculations" value="Admin, Controller" />
          <Row label="Reps can view own commissions" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Reps can dispute" value={<Pill tone="emerald">Enabled</Pill>} />
        </Card>
      </div>
    </CommissionLayout>
  );
}
