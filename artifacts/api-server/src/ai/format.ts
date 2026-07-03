/**
 * AI CFO Briefing Engine — shared formatting/number-safety helpers.
 *
 * Live FinanceOS entity/portfolio data is sourced from an external Drive
 * pipeline whose schema can vary by entity (e.g. some entities' metrics.json
 * omit margin/cash fields that the mock fixtures always populate). These
 * helpers make every downstream calculation and string tolerant of missing
 * or non-finite numeric fields instead of throwing, so the briefing degrades
 * gracefully rather than 500ing.
 */

/** num — coerces a possibly-missing/non-finite value to a safe number (default 0). */
export function num(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** isKnown — true when a numeric field is actually present and finite. */
export function isKnown(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function fmtMoney(n: number | null | undefined): string {
  if (!isKnown(n)) return "N/A";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (!isKnown(n)) return "N/A";
  return `${n.toFixed(1)}%`;
}

/** str — coerces a possibly-missing string to a safe display value. */
export function str(value: string | null | undefined, fallback = "an unknown date"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * safeValidation / safeFreshness — some live data sources expose validation
 * and freshness summaries under different field names than the declared
 * schema (e.g. `fail_count`/`generated_at` instead of `failed`/`run_date`).
 * These normalize to the fields the AI engine's prose relies on so no raw
 * `undefined` ever ends up in generated text.
 */
export function safeValidation(validation: {
  failed?: number;
  run_date?: string;
  total_checks?: number;
  all_passed?: boolean;
  [key: string]: unknown;
}): { failed: number; totalChecks: number; runDate: string; allPassed: boolean } {
  return {
    failed: num(validation.failed ?? (validation["fail_count"] as number | undefined)),
    totalChecks: num(validation.total_checks),
    runDate: str(validation.run_date ?? (validation["generated_at"] as string | undefined)),
    allPassed: Boolean(validation.all_passed),
  };
}

export function safeFreshness(freshness: {
  pipeline_run?: string;
  data_as_of?: string;
  [key: string]: unknown;
}): { pipelineRun: string; dataAsOf: string } {
  const pipelineRun = str(freshness.pipeline_run ?? (freshness["pipeline_date"] as string | undefined));
  return {
    pipelineRun,
    dataAsOf: str(freshness.data_as_of ?? (freshness["pipeline_date"] as string | undefined), pipelineRun),
  };
}
