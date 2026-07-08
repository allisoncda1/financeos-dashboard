import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card, Pill } from "@/components/accounting/AccountingUI";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export default function ForecastSettingsPage() {
  return (
    <ForecastLayout title="Settings" subtitle="Forecast module configuration">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Forecast Model">
          <Row label="Fiscal year" value="FY2026 (Jul 25 - Jun 26)" />
          <Row label="Forecast method" value="Driver-based" />
          <Row label="Actuals cutoff" value="Dec 2025" />
          <Row label="Auto-refresh with actuals" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Rolling forecast" value={<Pill tone="emerald">Enabled</Pill>} />
        </Card>

        <Card title="Data Sources">
          <Row label="Actuals source" value="FinanceOS Accounting" />
          <Row label="Budget source" value="Budget module (FY2026 v3)" />
          <Row label="Sync frequency" value="Daily, 9:00 AM CT" />
          <Row label="Last sync" value="Today at 9:02 AM" />
        </Card>

        <Card title="Alerts">
          <Row label="Cash below minimum" value="$2.0M threshold" />
          <Row label="Revenue variance alert" value="±5% vs budget" />
          <Row label="Email notifications" value={<Pill tone="emerald">Enabled</Pill>} />
          <Row label="Weekly digest" value={<Pill tone="emerald">Enabled</Pill>} />
        </Card>

        <Card title="Permissions">
          <Row label="Who can update forecast" value="Admin, CFO" />
          <Row label="Who can edit assumptions" value="Admin, CFO, Controller" />
          <Row label="Scenario creation" value="Admin, CFO" />
          <Row label="Investor read access" value={<Pill tone="gray">Disabled</Pill>} />
        </Card>
      </div>
    </ForecastLayout>
  );
}
