---
name: FinanceOS validation pipeline output contract
description: What the Drive-backed pipeline actually publishes for validation — summary counts only, no per-rule results.
---

# FinanceOS validation pipeline output (verified against live Drive, July 2026)

The pipeline's Drive folder `validation/` contains ONLY `validation_summary.json` and
`validation_summary.csv` (same fields). There is **no per-entity / per-rule breakdown
anywhere in the pipeline output**:

- The summary's `report_path` points at `/home/runner/work/financeos/...` — a file on
  the pipeline's own CI machine that is never uploaded to Drive. Do not assume
  `Validation_Report.md` is fetchable.
- Entity `anomalies.json` files carry NO rule ids — their shape is
  `{entity, category, severity, flag, detail, amount, txn_id, txn_date}` with
  categories like "Concentration"/"Stale AR"/"Weekend Posting" and severities
  INFO/HIGH. Any client code keying anomalies by `a.rule` only works on mock data.
- The live summary is internally inconsistent: `pass_count: 87` vs
  `total_checks: 40` (it appears to count finer-grained sub-checks), and
  `all_passed: false` while `fail_count: 0`.

**Why:** UI features that claim per-rule pass/fail must not fabricate cell statuses from
heuristics; the truthful state is "not reported" until the pipeline publishes per-check
results.

**How to apply:** `/api/validation/matrix` (built by `validationMatrix.ts` in api-server)
derives cells strictly from the summary — all "pass" only when consistent and zero
failures, otherwise "unknown" plus explicit `discrepancies[]`. If the pipeline ever
starts publishing per-check results to Drive, extend that builder rather than
reintroducing client-side heuristics.
