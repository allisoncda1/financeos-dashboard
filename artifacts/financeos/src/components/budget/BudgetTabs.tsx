import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_ITEMS = [
  { value: "summary", label: "Summary" },
  { value: "pl", label: "P&L" },
  { value: "cashflow", label: "Cash Flow" },
  { value: "balancesheet", label: "Balance Sheet" },
];

const triggerClasses =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-700 font-medium pb-2 px-0 text-slate-500 hover:text-slate-700";

export function BudgetTabs() {
  return (
    <TabsList className="bg-transparent border-b border-slate-200 rounded-none w-full justify-start h-auto p-0 space-x-6">
      {TAB_ITEMS.map((tab) => (
        <TabsTrigger key={tab.value} value={tab.value} className={triggerClasses}>
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
