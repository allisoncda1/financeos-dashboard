/**
 * Validation matrix builder — turns the pipeline's published validation
 * output into an honest per-entity × per-rule matrix.
 *
 * What the Drive-backed pipeline actually publishes (verified against the
 * live Drive folder):
 *   - validation/validation_summary.json — summary counts only
 *     (pass_count / fail_count / total_checks / all_passed / note). Its
 *     report_path points at a file on the pipeline's own CI machine that is
 *     NOT uploaded to Drive, and entity anomalies.json files carry no rule
 *     ids. There is no per-entity, per-rule breakdown anywhere in the
 *     pipeline output.
 *
 * So this module derives cell statuses ONLY from claims the pipeline
 * actually made, and reports "unknown" (not-reported) rather than
 * fabricating pass/warn/fail per cell:
 *   - Every cell is "pass" only when the summary is internally consistent
 *     AND reports zero failures (failed === 0 and all_passed is not false).
 *   - If the summary reports failures, they are unattributable to specific
 *     cells → every cell is "unknown".
 *   - If the summary contradicts itself (e.g. the live run reports 87
 *     passed checks against a declared total of 40, with all_passed=false
 *     yet fail_count=0), cells are "unknown" and each contradiction is
 *     spelled out in `discrepancies` so the UI can explain it truthfully.
 */

import { normalizeValidationSummary } from "../reports/renderers/validationView";
import { ENTITY_SLUGS, type EntitySlug } from "./types";

export type ValidationCellStatus = "pass" | "fail" | "unknown";

/** Canonical rule ids — 10 rules the pipeline's own note describes ("40 checks = 10 validation rules × 4 entities"). */
export const CANONICAL_RULE_IDS = ["1", "2", "2b", "3", "4", "5", "6", "7", "8a", "8b"] as const;

export type ValidationMatrixData = {
  generated_at: string | null;
  reported: {
    total_checks: number | null;
    passed: number | null;
    failed: number | null;
    all_passed: boolean | null;
    status_label: string;
    note: string | null;
  };
  expected_checks: number;
  rule_ids: string[];
  entity_slugs: EntitySlug[];
  /** The pipeline only publishes summary counts — never per-cell outcomes. */
  granularity: "summary_only";
  /** Human explanation of how the cell statuses below were derived. */
  cell_basis: string;
  /** Internal inconsistencies in the pipeline's own summary, spelled out. */
  discrepancies: string[];
  matrix: Record<EntitySlug, Record<string, ValidationCellStatus>>;
};

export function buildValidationMatrix(rawSummary: unknown): ValidationMatrixData {
  const s = normalizeValidationSummary(rawSummary);

  const raw = (rawSummary ?? {}) as Record<string, unknown>;
  const rulesChecked = Array.isArray(raw["rules_checked"])
    ? (raw["rules_checked"] as unknown[]).filter((r): r is string => typeof r === "string")
    : null;
  const ruleIds = rulesChecked && rulesChecked.length > 0 ? rulesChecked : [...CANONICAL_RULE_IDS];
  const entitySlugs = [...ENTITY_SLUGS];
  const expectedChecks = ruleIds.length * entitySlugs.length;

  const totalChecks = s?.totalChecks ?? null;
  const passed = s?.passed ?? null;
  const failed = s?.failed ?? null;
  const allPassed = s?.allPassed ?? null;

  const discrepancies: string[] = [];
  if (passed !== null && totalChecks !== null && passed > totalChecks) {
    discrepancies.push(
      `The pipeline reported ${passed} passed checks against a declared total of ${totalChecks} — it appears to count finer-grained sub-checks than the ${ruleIds.length} rules × ${entitySlugs.length} entities (${expectedChecks}) it declares.`,
    );
  } else if (passed !== null && failed !== null && totalChecks !== null && passed + failed !== totalChecks) {
    discrepancies.push(
      `Reported counts don't add up: ${passed} passed + ${failed} failed ≠ ${totalChecks} total checks.`,
    );
  }
  if (totalChecks !== null && totalChecks !== expectedChecks) {
    discrepancies.push(
      `Declared total of ${totalChecks} checks doesn't match the expected matrix shape of ${ruleIds.length} rules × ${entitySlugs.length} entities = ${expectedChecks}.`,
    );
  }
  if (allPassed === false && failed === 0) {
    discrepancies.push(
      `The pipeline flagged the run as not fully passed (all_passed=false) while also reporting 0 failed checks — the two claims contradict each other.`,
    );
  }

  // Cell derivation: only mark cells "pass" when the pipeline's summary is
  // internally consistent and claims zero failures. Anything else is
  // honestly "unknown" — the pipeline never publishes per-cell outcomes.
  const consistent = discrepancies.length === 0;
  const cellStatus: ValidationCellStatus =
    consistent && failed === 0 && allPassed !== false ? "pass" : "unknown";

  const cellBasis =
    cellStatus === "pass"
      ? "The pipeline publishes summary counts only (no per-rule outcomes). All cells are shown as passed because it reported 0 failed checks and a consistent total."
      : failed !== null && failed > 0
        ? `The pipeline reported ${failed} failed check(s) but does not publish which entity or rule failed, so individual cells cannot be attributed.`
        : "The pipeline publishes summary counts only (no per-rule outcomes), and its latest summary is internally inconsistent — individual cell results cannot be confirmed.";

  const matrix = Object.fromEntries(
    entitySlugs.map((slug) => [
      slug,
      Object.fromEntries(ruleIds.map((r) => [r, cellStatus])),
    ]),
  ) as Record<EntitySlug, Record<string, ValidationCellStatus>>;

  return {
    generated_at: s?.runDate ?? null,
    reported: {
      total_checks: totalChecks,
      passed,
      failed,
      all_passed: allPassed,
      status_label: s?.statusLabel ?? "Unknown",
      note: s?.note ?? null,
    },
    expected_checks: expectedChecks,
    rule_ids: ruleIds,
    entity_slugs: entitySlugs,
    granularity: "summary_only",
    cell_basis: cellBasis,
    discrepancies,
    matrix,
  };
}
