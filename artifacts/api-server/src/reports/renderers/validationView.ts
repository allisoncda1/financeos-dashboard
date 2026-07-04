/**
 * Report Engine — validation section normalizer.
 *
 * The `validation` section's `summary` payload has two observed shapes:
 *   - Mock data / the declared `ValidationSummary` type: run_date, as_of,
 *     total_checks, passed, failed, all_passed, entities, rules_checked,
 *     rule_count, entity_count.
 *   - Real Drive-backed pipeline output: generated_at, pipeline_status,
 *     pipeline_run_at, validation_result, all_passed, pass_count,
 *     fail_count, total_checks, report_path, note.
 *
 * Renderers must present whichever fields are actually there rather than
 * crash or silently print "undefined" — this normalizer reads both shapes
 * defensively without recalculating any values.
 */

export interface NormalizedValidation {
  runDate: string | undefined;
  totalChecks: number | undefined;
  passed: number | undefined;
  failed: number | undefined;
  allPassed: boolean | undefined;
  statusLabel: string;
  rulesChecked: string[] | undefined;
  note: string | undefined;
}

export function normalizeValidationSummary(raw: unknown): NormalizedValidation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;

  const runDate = typeof s.run_date === "string" ? s.run_date : typeof s.generated_at === "string" ? s.generated_at : undefined;
  const totalChecks = typeof s.total_checks === "number" ? s.total_checks : undefined;
  const passed = typeof s.passed === "number" ? s.passed : typeof s.pass_count === "number" ? s.pass_count : undefined;
  const failed = typeof s.failed === "number" ? s.failed : typeof s.fail_count === "number" ? s.fail_count : undefined;
  const allPassed = typeof s.all_passed === "boolean" ? s.all_passed : undefined;
  const rulesChecked = Array.isArray(s.rules_checked) ? (s.rules_checked as string[]) : undefined;
  const note = typeof s.note === "string" ? s.note : typeof s.report_path === "string" ? s.report_path : undefined;

  let statusLabel: string;
  if (allPassed !== undefined) {
    statusLabel = allPassed ? "All Passed" : "Issues Found";
  } else if (typeof s.validation_result === "string") {
    statusLabel = s.validation_result;
  } else if (typeof s.pipeline_status === "string") {
    statusLabel = s.pipeline_status;
  } else {
    statusLabel = "Unknown";
  }

  return { runDate, totalChecks, passed, failed, allPassed, statusLabel, rulesChecked, note };
}
