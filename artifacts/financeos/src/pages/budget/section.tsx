import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Construction } from "lucide-react";

type BudgetSectionPageProps = {
  title: string;
  description: string;
};

export default function BudgetSectionPage({ title, description }: BudgetSectionPageProps) {
  return (
    <BudgetLayout title={title} subtitle={description}>
      <div
        className="bg-white rounded-lg border border-slate-200 border-dashed p-16 flex flex-col items-center justify-center text-center"
        data-testid="card-under-construction"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <Construction className="w-6 h-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Under construction</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          The {title} page is coming soon. In the meantime, explore the Budget Dashboard for
          KPIs, charts and the full budget table.
        </p>
      </div>
    </BudgetLayout>
  );
}
