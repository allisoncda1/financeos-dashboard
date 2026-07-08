import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { RECON_ACCOUNT_LIST, RECON_MATCHES, RECON_HISTORY } from "@/lib/accountingMockData";
import { Link } from "wouter";
import { PlayCircle, Check } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const VIEWS = [
  { id: "accounts", label: "Accounts" },
  { id: "match-center", label: "Match Center" },
  { id: "history", label: "History" },
];

const STATUS_TONE: Record<string, string> = {
  Reconciled: "emerald",
  "In Progress": "amber",
  "Not Started": "gray",
};

export default function ReconciliationPage({ view = "accounts" }: { view?: string }) {
  const activeView = VIEWS.find(v => v.id === view) ?? VIEWS[0];

  return (
    <AccountingLayout title="Reconciliation" subtitle="Match bank activity against your ledger">
      <Card
        title="Reconciliation"
        action={<PrimaryButton testId="button-start-reconciliation"><PlayCircle className="w-3.5 h-3.5" /> Start New Reconciliation</PrimaryButton>}
      >
        <div className="px-5 pt-3 border-b border-gray-100">
          <div className="flex gap-6">
            {VIEWS.map(v => (
              <Link
                key={v.id}
                href={`/accounting/reconciliation/${v.id}`}
                data-testid={`tab-reconciliation-${v.id}`}
                className={`pb-3 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeView.id === v.id
                    ? "border-emerald-500 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>

        {activeView.id === "accounts" && (
          <DataTable headers={[
            { label: "Account" }, { label: "Period" }, { label: "Last Reconciled" },
            { label: "Difference", className: "text-right" }, { label: "Status" },
          ]}>
            {RECON_ACCOUNT_LIST.map(acc => (
              <tr key={acc.id} data-testid={`row-recon-account-${acc.id}`} className="hover:bg-gray-50 transition-colors">
                <Td className="font-semibold text-gray-900 text-[13px]">{acc.name}</Td>
                <Td>{acc.period}</Td>
                <Td>{acc.lastReconciled}</Td>
                <Td className={`text-right font-semibold ${acc.difference === 0 ? "text-gray-900" : "text-red-600"}`}>
                  {fmt(acc.difference)}
                </Td>
                <Td><Pill tone={STATUS_TONE[acc.status]}>{acc.status}</Pill></Td>
              </tr>
            ))}
          </DataTable>
        )}

        {activeView.id === "match-center" && (
          <DataTable headers={[
            { label: "Bank Line" }, { label: "Amount", className: "text-right" },
            { label: "Suggested Ledger Match" }, { label: "Amount", className: "text-right" },
            { label: "Confidence" }, { label: "" },
          ]}>
            {RECON_MATCHES.map(m => (
              <tr key={m.id} data-testid={`row-match-${m.id}`} className="hover:bg-gray-50 transition-colors">
                <Td className="font-medium text-gray-900 text-[13px]">{m.bankLine}</Td>
                <Td className="text-right font-semibold text-gray-900">{fmt(m.bankAmount)}</Td>
                <Td className="text-gray-500">{m.ledgerLine}</Td>
                <Td className="text-right">{fmt(m.ledgerAmount)}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-600">
                    <span className={`w-1.5 h-1.5 rounded-full ${m.confidence >= 95 ? "bg-emerald-500" : "bg-emerald-400"}`} />
                    {m.confidence}%
                  </span>
                </Td>
                <Td>
                  <button
                    data-testid={`button-match-${m.id}`}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Match
                  </button>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}

        {activeView.id === "history" && (
          <DataTable headers={[
            { label: "Account" }, { label: "Period" }, { label: "Completed" }, { label: "By" },
            { label: "Matched", className: "text-right" }, { label: "Difference", className: "text-right" },
            { label: "Status" },
          ]}>
            {RECON_HISTORY.map(h => (
              <tr key={h.id} data-testid={`row-history-${h.id}`} className="hover:bg-gray-50 transition-colors">
                <Td className="font-semibold text-gray-900 text-[13px]">{h.account}</Td>
                <Td>{h.period}</Td>
                <Td>{h.completed}</Td>
                <Td>{h.by}</Td>
                <Td className="text-right">{h.matched}</Td>
                <Td className="text-right">{fmt(h.difference)}</Td>
                <Td><Pill tone="emerald">{h.status}</Pill></Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </AccountingLayout>
  );
}
