import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function BudgetSettingsPage() {
  return (
    <BudgetLayout title="Settings" subtitle="Configure the Budget module">
      <div className="max-w-4xl space-y-6">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">General Configuration</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-slate-700">Fiscal Year Start Month</Label>
                <div className="col-span-2">
                  <Select defaultValue="july">
                    <SelectTrigger className="w-[240px]">
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
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-slate-700">Default Budget Method</Label>
                <div className="col-span-2">
                  <Select defaultValue="zero-based">
                    <SelectTrigger className="w-[240px]">
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
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Approval Workflow</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900">Require multi-level approvals</Label>
                  <p className="text-sm text-slate-500">Department owners must approve before CFO final sign-off.</p>
                </div>
                <Switch defaultChecked data-testid="switch-multi-approval" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900">Lock approved versions</Label>
                  <p className="text-sm text-slate-500">Prevent any further edits once a version status is Approved.</p>
                </div>
                <Switch defaultChecked data-testid="switch-lock-approved" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Departments</h3>
            <div className="space-y-2" data-testid="list-departments">
              {[
                { name: "Sales & Marketing", owner: "Sarah Jenkins" },
                { name: "G&A", owner: "Michael Chang" },
                { name: "Product / Tech", owner: "David Kim" },
                { name: "Operations", owner: "Elena Rostova" },
              ].map((dept) => (
                <div
                  key={dept.name}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{dept.name}</p>
                    <p className="text-xs text-slate-500">Owner: {dept.owner}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-500">Edit</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" data-testid="button-add-department">
                Add Department
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Account Mapping</h3>
            <p className="text-sm text-slate-500 mb-4">
              Map general ledger accounts to budget categories used across the module.
            </p>
            <div className="space-y-3" data-testid="list-account-mapping">
              {[
                { account: "4000 · Product Revenue", category: "revenue" },
                { account: "5000 · Cost of Goods Sold", category: "cogs" },
                { account: "6100 · Advertising & Marketing", category: "sm" },
                { account: "6200 · Salaries & Wages", category: "ga" },
                { account: "6300 · Software & Subscriptions", category: "pt" },
              ].map((row) => (
                <div key={row.account} className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-slate-700 col-span-2 sm:col-span-1">{row.account}</Label>
                  <div className="col-span-2">
                    <Select defaultValue={row.category}>
                      <SelectTrigger className="w-[240px]">
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
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900">Budget Submission Alerts</Label>
                  <p className="text-sm text-slate-500">Notify admins when a department budget is submitted.</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-submission" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900">Variance Threshold Warnings</Label>
                  <p className="text-sm text-slate-500">Send an alert when variance exceeds threshold.</p>
                </div>
                <Switch defaultChecked data-testid="switch-notify-variance" />
              </div>
              <div className="grid grid-cols-3 items-center gap-4 pt-2">
                <Label className="text-slate-700">Variance Threshold (%)</Label>
                <div className="col-span-2">
                  <Input type="number" defaultValue="5" className="w-[120px]" data-testid="input-variance-threshold" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" data-testid="button-cancel-settings">Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-save-settings">Save Configuration</Button>
        </div>
      </div>
    </BudgetLayout>
  );
}
