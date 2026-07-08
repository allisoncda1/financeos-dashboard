import { useState } from "react";
import { Link } from "wouter";
import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { ACCOUNTING_KPIS, TRANSACTIONS, AI_SUGGESTIONS, RECENT_ACTIVITY, BANK_ACCOUNTS, RECONCILIATION_ACCOUNTS } from "@/lib/accountingMockData";
import { 
  FileText, ArrowRightLeft, CheckCircle, Users, Building2, MoreHorizontal,
  ArrowRight, Search, BrainCircuit, FileCheck, Repeat, PlayCircle, MoreVertical
} from "lucide-react";

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState("Uncategorized");

  return (
    <AccountingLayout title="Accounting Workspace" subtitle="Your daily accounting tasks at a glance">
      
      {/* KPIs */}
      <section>
        <h2 className="text-[13px] font-semibold text-gray-900 mb-3">Today's Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {ACCOUNTING_KPIS.map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: kpi.iconBg }}>
                  <kpi.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[22px] font-bold text-gray-900 leading-tight">{kpi.value}</p>
                  <p className="text-[11px] text-gray-500 font-medium leading-snug mt-0.5">{kpi.label}</p>
                </div>
              </div>
              <Link href={kpi.href} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-4 mt-auto">
                {kpi.description}
              </Link>
            </div>
          ))}
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
          { icon: MoreHorizontal, label: "More Actions", id: "action-more" }
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
        
        {/* Left Column: Transaction Queue & Bank/Reconciliation */}
        <div className="xl:col-span-2 space-y-6">
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-semibold text-gray-900">Transactions to Categorize</h2>
                <div className="bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full">37</div>
              </div>
            </div>
            
            <div className="px-5 pt-3 border-b border-gray-100">
              <div className="flex gap-6">
                {[
                  { id: "All", count: null },
                  { id: "Uncategorized", count: 37 },
                  { id: "Suggested", count: 12 },
                  { id: "Reviewed", count: 0 }
                ].map(tab => (
                  <button
                    key={tab.id}
                    data-testid={`tab-transactions-${tab.id.toLowerCase()}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-[12px] font-semibold transition-colors border-b-2 ${
                      activeTab === tab.id ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.id} {tab.count !== null && <span className="ml-1 text-gray-400 font-normal">{tab.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 w-10"><input type="checkbox" className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" /></th>
                    <th className="px-2 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Suggested Category</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {TRANSACTIONS.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3"><input type="checkbox" className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" /></td>
                      <td className="px-2 py-3 text-[12px] text-gray-600">{tx.date}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{tx.description}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">{tx.account}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tx.categoryColor}`}>
                          {tx.suggestedCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${tx.confidenceColor}`} />
                          <span className="text-[12px] font-medium text-gray-700">{tx.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900 text-right">
                        {tx.amount < 0 ? `-$${Math.abs(tx.amount).toFixed(2)}` : `$${tx.amount.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-center">
              <Link href="/accounting/transactions/uncategorized" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                View all 37 transactions <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
               <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                 <h2 className="text-[14px] font-semibold text-gray-900">Bank Accounts</h2>
                 <Link href="/accounting/chart-of-accounts" className="text-[11px] font-medium text-emerald-600">Manage</Link>
               </div>
               <div className="divide-y divide-gray-100">
                 {BANK_ACCOUNTS.map(acc => (
                   <div key={acc.id} className="px-5 py-3.5 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
                         <Building2 className="w-4 h-4 text-gray-500" />
                       </div>
                       <div>
                         <p className="text-[13px] font-semibold text-gray-900">{acc.name}</p>
                         <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                           <CheckCircle className="w-3 h-3" /> {acc.status}
                         </p>
                       </div>
                     </div>
                     <p className="text-[14px] font-bold text-gray-900">
                       {acc.balance < 0 ? `-$${Math.abs(acc.balance).toLocaleString("en-US", {minimumFractionDigits: 2})}` : `$${acc.balance.toLocaleString("en-US", {minimumFractionDigits: 2})}`}
                     </p>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
               <div className="px-5 py-4 border-b border-gray-100">
                 <h2 className="text-[14px] font-semibold text-gray-900">Reconciliation</h2>
               </div>
               <div className="divide-y divide-gray-100 flex-1">
                 {RECONCILIATION_ACCOUNTS.map(rec => (
                   <div key={rec.id} className="px-5 py-3.5 flex items-center justify-between">
                     <div>
                       <p className="text-[13px] font-semibold text-gray-900">{rec.name}</p>
                       <p className="text-[11px] text-gray-500 mt-0.5">{rec.period} • {rec.balance < 0 ? `-$${Math.abs(rec.balance).toLocaleString("en-US", {minimumFractionDigits: 2})}` : `$${rec.balance.toLocaleString("en-US", {minimumFractionDigits: 2})}`}</p>
                     </div>
                     <div className="text-right flex flex-col items-end">
                       {rec.status === "Reconciled" ? (
                         <>
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                             {rec.status}
                           </span>
                           <span className="text-[10px] text-gray-400 mt-1">{rec.date}</span>
                         </>
                       ) : (
                         <>
                           <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                             {rec.status}
                           </span>
                           <span className="text-[10px] text-gray-500 mt-1 font-medium">{rec.matchPercent}% matched</span>
                         </>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
               <div className="p-4 border-t border-gray-100 bg-gray-50">
                 <button className="w-full flex items-center justify-center gap-2 py-2 border border-emerald-500 text-emerald-600 rounded-lg text-[12px] font-semibold hover:bg-emerald-50 transition-colors">
                   Start New Reconciliation
                 </button>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Suggestions & Recent Activity */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-[#F8FAFC] border border-blue-100 rounded-xl shadow-sm overflow-hidden relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="px-5 py-4 border-b border-blue-100/50 flex items-center gap-2 relative z-10">
               <BrainCircuit className="w-4 h-4 text-blue-600" />
               <h2 className="text-[14px] font-semibold text-gray-900">AI Suggestions</h2>
            </div>
            <div className="divide-y divide-blue-50 relative z-10">
              {AI_SUGGESTIONS.map(sug => (
                <button key={sug.id} className="w-full text-left px-5 py-3.5 hover:bg-blue-50/50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${sug.iconBg} flex items-center justify-center shrink-0`}>
                      <sug.icon className={`w-4 h-4 ${sug.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">{sug.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{sug.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
               <h2 className="text-[14px] font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="px-5 py-4">
              <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pb-2">
                {RECENT_ACTIVITY.map((act, i) => (
                  <div key={act.id} className="relative pl-5">
                    <div className={`absolute -left-[17px] top-0 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white ${act.iconBg}`}>
                      <act.icon className={`w-3.5 h-3.5 ${act.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900 leading-tight">{act.title}</p>
                      {act.description && <p className="text-[11px] text-gray-500 mt-0.5">{act.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-center">
              <Link href="/accounting/reconciliation/history" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
                View all activity &rarr;
              </Link>
            </div>
          </div>
        </div>

      </div>
    </AccountingLayout>
  );
}
