import { Link } from "wouter";
import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingAccounts, useAccountingTransactions, useAccountingInvoices } from "@/hooks/useApi";
import {
  FileText, ArrowRightLeft, CheckCircle, Users, Building2, MoreHorizontal,
  ArrowRight, BrainCircuit, AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

export default function WorkspacePage() {
  const { activeSlug } = useAccountingEntity();
  const { data: accounts }     = useAccountingAccounts(activeSlug);
  const { data: transactions }  = useAccountingTransactions(activeSlug);
  const { data: invoices }      = useAccountingInvoices(activeSlug);

  const bankAccounts  = (accounts ?? []).filter(a => a.accountType === "Bank" && a.isActive);
  const totalTx       = transactions?.length ?? null;
  const unreconciled  = transactions?.filter(t => !t.isReconciled).length ?? null;
  const overdueInvAmt = invoices?.filter(i => (i.daysOverdue ?? 0) > 0).reduce((s, i) => s + i.balance, 0) ?? null;

  return (
    <AccountingLayout title="Accounting Workspace" subtitle="Your daily accounting tasks at a glance">

      {/* Live KPI strip */}
      <section>
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Today's Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[22px] font-bold text-gray-900 leading-tight">
              {totalTx !== null ? totalTx : "—"}
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Total transactions (synced)</p>
            <Link href="/accounting/transactions" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-4">
              View transactions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[22px] font-bold text-amber-700 leading-tight">
              {unreconciled !== null ? unreconciled : "—"}
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Unreconciled transactions</p>
            <Link href="/accounting/reconciliation" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-4">
              Reconciliation <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className={`text-[22px] font-bold leading-tight ${overdueInvAmt ? "text-red-600" : "text-gray-900"}`}>
              {overdueInvAmt !== null ? fmt(overdueInvAmt) : "—"}
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Overdue AR</p>
            <Link href="/accounting/invoices" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-4">
              View invoices <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="flex flex-wrap gap-3">
        {[
          { icon: FileText, label: "Create Invoice", id: "action-create-invoice" },
          { icon: ArrowRightLeft, label: "Import Bank Transactions", id: "action-import-bank" },
          { icon: CheckCircle, label: "Start Reconciliation", id: "action-start-reconciliation" },
          { icon: Users, label: "New Customer", id: "action-new-customer" },
          { icon: Building2, label: "New Vendor", id: "action-new-vendor" },
          { icon: MoreHorizontal, label: "More Actions", id: "action-more" },
        ].map((action, i) => (
          <button
            key={i}
            data-testid={action.id}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-[12px] font-semibold text-gray-700"
          >
            <action.icon className="w-4 h-4 text-gray-500" />
            {action.label}
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6">

          {/* Categorization — requires engine */}
          <div className="bg-white border border-amber-100 rounded-xl shadow-sm p-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Transaction categorization not available</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Auto-categorization and AI confidence scoring require a categorization rule engine. This feature is planned
                for a future FinanceOS release. View raw transactions on the{" "}
                <Link href="/accounting/transactions" className="text-emerald-600 font-medium hover:underline">
                  Transactions page
                </Link>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Accounts — live data */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-gray-900">Bank Accounts</h2>
                <Link href="/accounting/chart-of-accounts" className="text-[11px] font-medium text-emerald-600">Manage</Link>
              </div>
              <div className="divide-y divide-gray-100 flex-1">
                {bankAccounts.length === 0 ? (
                  <div className="px-5 py-4 text-[12px] text-gray-400">
                    {accounts === undefined ? "Loading…" : "No active bank accounts found."}
                  </div>
                ) : (
                  bankAccounts.map(acc => (
                    <div key={acc.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
                          <Building2 className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900">{acc.name}</p>
                          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Synced
                          </p>
                        </div>
                      </div>
                      <p className={`text-[14px] font-bold ${acc.currentBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
                        {fmt(acc.currentBalance)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Reconciliation — requires engine */}
            <div className="bg-white border border-amber-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-[14px] font-semibold text-gray-900">Reconciliation</h2>
              </div>
              <div className="px-5 py-6 flex-1 flex items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-500">Reconciliation engine not yet configured.</p>
                  <Link href="/accounting/reconciliation" className="text-[11px] text-emerald-600 font-medium mt-2 block hover:underline">
                    Go to Reconciliation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#F8FAFC] border border-blue-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-blue-100/50 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <h2 className="text-[14px] font-semibold text-gray-900">AI Suggestions</h2>
            </div>
            <div className="px-5 py-6 text-center">
              <AlertCircle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-500">
                AI-powered suggestions require the categorization engine. Not yet available.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-[14px] font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="px-5 py-6 text-center">
              <p className="text-[12px] text-gray-400">
                Activity feed requires operational event tracking. Not yet available.
              </p>
              <Link href="/accounting/transactions" className="text-[11px] text-emerald-600 font-medium mt-2 block hover:underline">
                View recent transactions →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </AccountingLayout>
  );
}
