import { useState } from "react";
import { Check, Save, AlertTriangle } from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DEFAULT_ANALYTICS_SETTINGS } from "@/lib/analyticsDemoData";
import type { AllocationMethod, AnalyticsSettings } from "@/lib/analyticsTypes";

const METHODS: AllocationMethod[] = [
  "Fixed Percentage",
  "Equal Split",
  "Revenue Based",
  "Headcount Based",
  "Employee Time Based",
  "Transaction Volume Based",
  "Client Count Based",
  "User Count Based",
  "Square Footage Based",
  "Manual Allocation",
  "Custom Driver",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function AnalyticsSettingsPage() {
  const [settings, setSettings] = useState<AnalyticsSettings>({ ...DEFAULT_ANALYTICS_SETTINGS });
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AnalyticsSettings>(key: K, value: AnalyticsSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  return (
    <AnalyticsLayout
      title="Analytics Settings"
      subtitle="Configure cost structure, methods, thresholds and controls."
      showScenario={false}
      showBasis={false}
      actions={
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <Button
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-medium px-3 text-xs shadow-sm"
            onClick={() => setSaved(true)}
            data-testid="button-save-settings"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation defaults */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Allocation Defaults</h3>
          </div>
          <div>
            <Row label="Materiality Threshold" hint="Skip manual review for shared expenses below this amount.">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-400">$</span>
                <Input
                  type="number"
                  min={0}
                  value={settings.materialityThreshold}
                  onChange={(e) => update("materialityThreshold", Number(e.target.value))}
                  className="h-8 w-24 text-sm text-right"
                  data-testid="input-materiality"
                />
              </div>
            </Row>
            <Row label="Default Allocation Method">
              <Select value={settings.defaultMethod} onValueChange={(v) => update("defaultMethod", v as AllocationMethod)}>
                <SelectTrigger className="h-8 w-48 text-sm" data-testid="select-default-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Require Approval" hint="Allocations must be approved before posting to analytics.">
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(v) => update("requireApproval", v)}
                data-testid="switch-require-approval"
              />
            </Row>
            <Row label="Allocation Period">
              <Select value={settings.allocationPeriod} onValueChange={(v) => update("allocationPeriod", v as AnalyticsSettings["allocationPeriod"])}>
                <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-allocation-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Allocation Rounding">
              <Select value={settings.rounding} onValueChange={(v) => update("rounding", v as AnalyticsSettings["rounding"])}>
                <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-rounding">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cent">Nearest Cent</SelectItem>
                  <SelectItem value="Dollar">Nearest Dollar</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </div>
        </div>

        {/* Accounting & period */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Accounting & Period</h3>
          </div>
          <div>
            <Row label="Fiscal Year Start">
              <Select value={settings.fiscalYearStart} onValueChange={(v) => update("fiscalYearStart", v)}>
                <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-fiscal-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Accounting Basis">
              <Select value={settings.accountingBasis} onValueChange={(v) => update("accountingBasis", v as AnalyticsSettings["accountingBasis"])}>
                <SelectTrigger className="h-8 w-36 text-sm" data-testid="select-basis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accrual">Accrual</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Currency">
              <span className="text-sm font-medium text-gray-700">{settings.currency}</span>
            </Row>
            <Row label="Closed Through" hint="Periods on or before this date are locked.">
              <span className="text-sm font-medium text-gray-700">{settings.closedThrough}</span>
            </Row>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-red-100 bg-red-50/50">
          <h3 className="text-sm font-semibold text-red-700 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h3>
        </div>
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Recalculate All Allocations</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Re-runs every active rule across all open periods. This can overwrite draft allocations.
            </p>
          </div>
          <Button variant="outline" className="h-8 border-red-200 text-red-600 hover:bg-red-50 text-xs" disabled data-testid="button-recalculate">
            Recalculate
          </Button>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
