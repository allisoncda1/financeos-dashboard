import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { CommissionKPICards } from "@/components/commission/CommissionKPICards";
import { CommissionTrendChart } from "@/components/commission/CommissionTrendChart";
import { CommissionRepChart } from "@/components/commission/CommissionRepChart";
import { CommissionStatusTable } from "@/components/commission/CommissionStatusTable";
import { CommissionPlanCard } from "@/components/commission/CommissionPlanCard";
import { UpcomingPayoutCard } from "@/components/commission/UpcomingPayoutCard";

export default function CommissionOverviewPage() {
  return (
    <CommissionLayout title="Commission Overview" subtitle="Track, calculate and manage sales commissions">
      <CommissionKPICards />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <CommissionTrendChart />
        </div>
        <div className="xl:col-span-2">
          <CommissionRepChart />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <CommissionStatusTable />
        </div>
        <div className="xl:col-span-2 space-y-6">
          <CommissionPlanCard />
          <UpcomingPayoutCard />
        </div>
      </div>
    </CommissionLayout>
  );
}
