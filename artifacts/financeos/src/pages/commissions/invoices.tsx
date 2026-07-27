import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { CommissionStatusTable } from "@/components/commission/CommissionStatusTable";

export default function CommissionInvoicesPage() {
  return (
    <CommissionLayout title="Commission Invoices" subtitle="Track commissionable invoices by status">
      <CommissionStatusTable />
    </CommissionLayout>
  );
}
