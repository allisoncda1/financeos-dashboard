import type { ValidationSummary } from "@/lib/types";

type Props = { validation: ValidationSummary };

export function ValidationBadge({ validation }: Props) {
  const { all_passed, passed, total_checks, run_date } = validation;
  const failed = total_checks - passed;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
        all_passed
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      <span>{all_passed ? "✅" : "❌"}</span>
      <span>
        {all_passed
          ? `${passed}/${total_checks} validation checks passed`
          : `${failed} of ${total_checks} checks failed`}
      </span>
      <span className="opacity-50">·</span>
      <span className="opacity-60">{run_date}</span>
    </div>
  );
}
