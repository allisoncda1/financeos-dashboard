import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, CashFlowStatement, CashFlowSection, CashFlowLine } from "../lib/types";

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

/** "OPERATING ACTIVITIES" → "Operating Activities" */
function titleCase(section: string): string {
  return section
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * cash_flow_gaap.csv is a QBO-style GAAP statement of cash flows export:
 * entity,report_date,activity_section,sub_section,label,amount,is_total
 *
 * Rows arrive in statement order. activity_section is one of
 * "OPERATING ACTIVITIES" / "INVESTING ACTIVITIES" / "FINANCING ACTIVITIES" /
 * "Other". Within an activity section:
 *   - is_total=False rows are individual line items,
 *   - is_total=True rows whose label starts with "Total ..." are subtotals of
 *     a sub_section group (kept as subtotal lines),
 *   - the is_total=True "Net cash provided by ..." row is the section's net.
 * The "Other" section carries the statement summary rows
 * ("Net cash increase for period" and "Cash at end of period").
 */
export async function transformCashFlow(
  slug: EntitySlug,
  asOf: string,
): Promise<CashFlowStatement | null> {
  let rows: Record<string, string>[];
  try {
    rows = await driveLoadCsv(`entities/${slug}/cash_flow_gaap.csv`);
  } catch (err) {
    console.warn(`[transformCashFlow] failed to load cash_flow_gaap.csv for ${slug}:`, err);
    return null;
  }
  if (rows.length === 0) return null;

  const sections: CashFlowSection[] = [];
  let netCashChange: number | null = null;
  let cashAtEnd: number | null = null;
  let reportDate = "";
  let current: CashFlowSection | null = null;

  for (const row of rows) {
    const sectionName = (row["activity_section"] ?? "").trim();
    const label = (row["label"] ?? "").trim();
    const amount = toNumber(row["amount"]);
    const isTotal = toBoolean(row["is_total"]);
    if (!reportDate && row["report_date"]) reportDate = row["report_date"].trim();
    if (!label) continue;

    const normalizedSection = sectionName.toLowerCase();
    if (normalizedSection === "other" || normalizedSection === "") {
      const normalizedLabel = label.toLowerCase();
      if (normalizedLabel.startsWith("net cash increase") || normalizedLabel.startsWith("net cash decrease")) {
        netCashChange = amount;
      } else if (normalizedLabel.startsWith("cash at end")) {
        cashAtEnd = amount;
      }
      continue;
    }

    if (!current || current.name !== titleCase(sectionName)) {
      current = { name: titleCase(sectionName), lines: [], net_cash: 0 };
      sections.push(current);
    }

    if (isTotal && label.toLowerCase().startsWith("net cash")) {
      current.net_cash = amount;
      continue;
    }

    const line: CashFlowLine = {
      label,
      amount,
      is_subtotal: isTotal,
    };
    current.lines.push(line);
  }

  if (sections.length === 0) return null;

  return {
    as_of: reportDate || asOf,
    sections,
    net_cash_change: netCashChange,
    cash_at_end: cashAtEnd,
  };
}
