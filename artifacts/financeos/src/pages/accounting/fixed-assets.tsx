import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, PrimaryButton, MiniKpi } from "@/components/accounting/AccountingUI";
import { FIXED_ASSETS } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function FixedAssetsPage() {
  const totalCost = FIXED_ASSETS.reduce((s, a) => s + a.cost, 0);
  const totalDep = FIXED_ASSETS.reduce((s, a) => s + a.accumDep, 0);

  return (
    <AccountingLayout title="Fixed Assets" subtitle="Asset register and depreciation">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Total cost" value={fmt(totalCost)} sub={`${FIXED_ASSETS.length} assets`} tone="gray" />
        <MiniKpi label="Accumulated depreciation" value={fmt(totalDep)} sub="Through June 2026" tone="amber" />
        <MiniKpi label="Net book value" value={fmt(totalCost - totalDep)} sub="As of Jul 2026" tone="emerald" />
      </div>

      <Card
        title="Asset Register"
        action={<PrimaryButton testId="button-new-asset"><Plus className="w-3.5 h-3.5" /> New Asset</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Asset" }, { label: "Category" }, { label: "Purchased" },
          { label: "Cost", className: "text-right" },
          { label: "Accum. Dep.", className: "text-right" },
          { label: "Book Value", className: "text-right" },
          { label: "Method" },
        ]}>
          {FIXED_ASSETS.map(a => (
            <tr key={a.id} data-testid={`row-asset-${a.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{a.name}</Td>
              <Td className="text-gray-500">{a.category}</Td>
              <Td>{a.purchased}</Td>
              <Td className="text-right">{fmt(a.cost)}</Td>
              <Td className="text-right text-gray-500">{fmt(a.accumDep)}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(a.cost - a.accumDep)}</Td>
              <Td className="text-gray-500">{a.method}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
