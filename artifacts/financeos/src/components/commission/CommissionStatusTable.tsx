import { useState } from "react";
import { COMMISSION_INVOICES, COMMISSION_STATUS_COUNTS, type CommissionStatus } from "@/lib/commissionMockData";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { Search, Filter, Download, FileText } from "lucide-react";
import { Link } from "wouter";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<CommissionStatus, string> = {
  Pending: "amber",
  Approved: "emerald",
  Locked: "indigo",
  Paid: "purple",
};

const TABS: { id: string; label: string; status?: CommissionStatus; count?: number }[] = [
  { id: "all", label: "All", count: COMMISSION_STATUS_COUNTS.all },
  { id: "pending", label: "Pending", status: "Pending", count: COMMISSION_STATUS_COUNTS.pending },
  { id: "approved", label: "Approved", status: "Approved", count: COMMISSION_STATUS_COUNTS.approved },
  { id: "locked", label: "Locked", status: "Locked", count: COMMISSION_STATUS_COUNTS.locked },
  { id: "paid", label: "Paid", status: "Paid", count: COMMISSION_STATUS_COUNTS.paid },
];

export function CommissionStatusTable() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const activeTab = TABS.find(t => t.id === tab) ?? TABS[0];
  const rows = COMMISSION_INVOICES.filter(inv => {
    if (activeTab.status && inv.status !== activeTab.status) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.customer.toLowerCase().includes(q) ||
        inv.rep.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card
      title="Commission Status (Jun 2026)"
      action={
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search invoices or clients..."
              data-testid="input-commission-search"
              className="h-8 w-[200px] pl-8 pr-3 rounded-lg border border-gray-200 bg-white text-[12px] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 shadow-sm hover:bg-gray-50" data-testid="button-commission-filter">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50" data-testid="button-commission-export" title="Export">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <div className="px-5 pt-3 border-b border-gray-100">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-commission-status-${t.id}`}
              className={`pb-3 text-[12px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
                tab === t.id ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.id !== "all" && <span className="ml-1 text-gray-400 font-normal">({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      <DataTable headers={[
        { label: "Invoice #" }, { label: "Client" }, { label: "Sales Rep" }, { label: "Invoice Date" },
        { label: "Invoice Amount", className: "text-right" },
        { label: "Commission Amount", className: "text-right" },
        { label: "Status" },
      ]}>
        {rows.map(inv => (
          <tr key={inv.id} data-testid={`row-commission-${inv.number}`} className="hover:bg-gray-50 transition-colors">
            <Td className="font-semibold text-gray-900 text-[13px]">
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-gray-300" />
                {inv.number}
              </span>
            </Td>
            <Td>{inv.customer}</Td>
            <Td>{inv.rep}</Td>
            <Td>{inv.date}</Td>
            <Td className="text-right">{fmt(inv.invoiceAmount)}</Td>
            <Td className="text-right font-semibold text-gray-900">{fmt(inv.commissionAmount)}</Td>
            <Td><Pill tone={STATUS_TONE[inv.status]}>{inv.status}</Pill></Td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-gray-400">
              No invoices match your search.
            </td>
          </tr>
        )}
      </DataTable>

      <div className="px-5 py-3 border-t border-gray-100">
        <Link href="/commissions/invoices" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700" data-testid="link-view-all-commissions">
          View all commissions
        </Link>
      </div>
    </Card>
  );
}
