import { UPCOMING_PAYOUT } from "@/lib/commissionMockData";
import { Card, Pill } from "@/components/accounting/AccountingUI";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-b-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[12px] font-semibold text-gray-900">{value}</span>
    </div>
  );
}

export function UpcomingPayoutCard() {
  return (
    <Card title="Upcoming Payout">
      <div className="px-5 py-2">
        <Row label="Payout Period" value={UPCOMING_PAYOUT.period} />
        <Row label="Total Amount" value={fmt(UPCOMING_PAYOUT.totalAmount)} />
        <Row label="Payout Date" value={UPCOMING_PAYOUT.payoutDate} />
        <Row label="Status" value={<Pill tone="amber">{UPCOMING_PAYOUT.status}</Pill>} />
        <Link
          href="/commissions/payouts"
          data-testid="link-view-payout-details"
          className="flex items-center justify-between py-3 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View payout details <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
}
