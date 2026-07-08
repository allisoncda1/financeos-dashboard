import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function BudgetSettingsPage() {
  return (
    <BudgetLayout title="Settings" subtitle="Configure the Budget module">
      <div className="max-w-4xl space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">General Configuration</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
              <Label className="text-[12px] text-gray-700">Fiscal Year Start Month</Label>
              <div className="col-span-1 sm:col-span-2">
                <Select defaultValue="july">
                  <SelectTrigger className="w-full sm:w-[240px] h-8 text-xs border-gray-200">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="july">July</SelectItem>
                    <SelectItem value="october">October</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
              <Label className="text-[12px] text-gray-700">Default Budget Method</Label>
              <div className="col-span-1 sm:col-span-2">
                <Select defaultValue="zero-based">
                  <SelectTrigger className="w-full sm:w-[240px] h-8 text-xs border-gray-200">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="historical">Historical + Growth</SelectItem>
                    <SelectItem value="zero-based">Zero-Based</SelectItem>
                    <SelectItem value="rolling">Rolling Forecast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Approval Workflow</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[12px] font-medium text-gray-900">Require multi-level approvals</Label>
                <p className="text-[11px] text-gray-500">Department owners must approve before CFO final sign-off.</p>
              </div>
              <Switch defaultChecked data-testid="switch-multi-approval" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[12px] font-medium text-gray-900">Lock approved versions</Label>
                <p className="text-[11px] text-gray-500">Prevent any further edits once a version status is Approved.</p>
              </div>
              <Switch defaultChecked data-testid="switch-lock-approved" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Departments</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2.5" data-testid="list-departments">
              {[
                { name: "Sales & Marketing", owner: "Sarah Jenkins" },
                { name: "G&A", owner: "Michael Chang" },
                { name: "Product / Tech", owner: "David Kim" },
                { name: "Operations", owner: "Elena Rostova" },
              ].map((dept) => (
                <div
                  key={dept.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 bg-gray-50/50"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-gray-900">{dept.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Owner: {dept.owner}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500">Edit</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-3 h-8 text-xs text-gray-600 bg-white" data-testid="button-add-department">
                Add Department
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Account Mapping</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Map general ledger accounts to budget categories used across the module.
            </p>
          </div>
          <div className="p-4">
            <div className="space-y-3" data-testid="list-account-mapping">
              {[
                { account: "4000 · Product Revenue", category: "revenue" },
                { account: "5000 · Cost of Goods Sold", category: "cogs" },
                { account: "6100 · Advertising & Marketing", category: "sm" },
                { account: "6200 · Salaries & Wages", category: "ga" },
                { account: "6300 · Software & Subscriptions", category: "pt" },
              ].map((row) => (
                <div key={row.account} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                  <Label className="text-[12px] text-gray-700 col-span-1 sm:col-span-1">{row.account}</Label>
                  <div className="col-span-1 sm:col-span-2">
                    <Select defaultValue={row.category}>
                      <SelectTrigger className="w-full sm:w-[240px] h-8 text-xs border-gray-200">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="cogs">COGS</SelectItem>
                        <SelectItem value="sm">Sales & Marketing</SelectItem>
                        <SelectItem value="ga">G&A</SelectItem>
                        <SelectItem value="pt">Product / Tech</SelectItem>
                        <SelectItem value="other">Other Expenses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Notifications</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[12px] font-medium text-gray-900">Budget Submission Alerts</Label>
                <p className="text-[11px] text-gray-500">Notify admins when a department budget is submitted.</p>
              </div>
              <Switch defaultChecked data-testid="switch-notify-submission" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-[12px] font-medium text-gray-900">Variance Threshold Warnings</Label>
                <p className="text-[11px] text-gray-500">Send an alert when variance exceeds threshold.</p>
              </div>
              <Switch defaultChecked data-testid="switch-notify-variance" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4 pt-1 border-t border-gray-50">
              <Label className="text-[12px] text-gray-700">Variance Threshold (%)</Label>
              <div className="col-span-1 sm:col-span-2">
                <Input type="number" defaultValue="5" className="w-[120px] h-8 text-xs border-gray-200" data-testid="input-variance-threshold" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" className="h-8 text-xs bg-white text-gray-600" data-testid="button-cancel-settings">Cancel</Button>
          <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-4" data-testid="button-save-settings">Save Configuration</Button>
        </div>
      </div>
    </BudgetLayout>
  );
}
