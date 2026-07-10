import { BookOpen } from "lucide-react";

export default function BudgetAssumptionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h1 className="text-xl font-semibold text-white">Budget Assumptions</h1>
        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded">V2</span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center space-y-3">
        <BookOpen className="w-10 h-10 text-white/20 mx-auto" />
        <p className="text-white/60 font-medium">No assumptions recorded</p>
        <p className="text-white/30 text-sm max-w-md mx-auto">
          A structured assumptions log (growth rates, headcount, unit economics) is coming in V2.
        </p>
      </div>
    </div>
  );
}
