import { desc, sql } from "drizzle-orm";
import { opsDb as db } from "./connection";
import { reportHistory } from "@workspace/db";

export type { ReportHistoryRow, InsertReportHistory } from "@workspace/db";

export type ReportHistoryEntry = {
  id: string;
  template: string;
  title: string;
  period: string;
  format: string;
  entitySlugs: string[];
  status: string;
  source: string | null;
  dataFreshness: string | null;
  entityCount: number | null;
  confidenceScore: number | null;
  requestedBy: string | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
};

function toEntry(row: typeof reportHistory.$inferSelect): ReportHistoryEntry {
  return {
    id:              row.id,
    template:        row.template,
    title:           row.title,
    period:          row.period,
    format:          row.format,
    entitySlugs:     row.entitySlugs ?? [],
    status:          row.status,
    source:          row.source ?? null,
    dataFreshness:   row.dataFreshness ?? null,
    entityCount:     row.entityCount ?? null,
    confidenceScore: row.confidenceScore ?? null,
    requestedBy:     row.requestedBy ?? null,
    errorMessage:    row.errorMessage ?? null,
    completedAt:     row.completedAt ? row.completedAt.toISOString() : null,
    createdAt:       row.createdAt.toISOString(),
  };
}

export async function insertReportHistory(
  data: typeof reportHistory.$inferInsert,
): Promise<ReportHistoryEntry> {
  const rows = await db
    .insert(reportHistory)
    .values(data)
    .returning();
  return toEntry(rows[0]!);
}

export async function listReportHistory(opts?: {
  slug?: string;
  limit?: number;
  offset?: number;
}): Promise<ReportHistoryEntry[]> {
  const limit  = Math.min(opts?.limit  ?? 50, 200);
  const offset = opts?.offset ?? 0;

  const rows = opts?.slug
    ? await db
        .select()
        .from(reportHistory)
        .where(sql`${opts.slug} = ANY(${reportHistory.entitySlugs})`)
        .orderBy(desc(reportHistory.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(reportHistory)
        .orderBy(desc(reportHistory.createdAt))
        .limit(limit)
        .offset(offset);

  return rows.map(toEntry);
}
