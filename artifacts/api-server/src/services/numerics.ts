/**
 * Shared numeric coercion for all DB modules and transformers.
 *
 * Postgres NUMERIC columns return as strings via Drizzle. Drive CSV cells
 * arrive as strings or undefined. Some callers already have a JavaScript
 * number. This function handles all three cases consistently:
 *   - number  → returned as-is (0 if non-finite)
 *   - string  → parsed via parseFloat (0 if non-finite or empty)
 *   - null / undefined → 0
 */
export function parseNumeric(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const parsed = parseFloat(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
