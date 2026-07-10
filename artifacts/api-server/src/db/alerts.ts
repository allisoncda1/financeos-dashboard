import { eq, and, desc, ne } from "drizzle-orm";
import { db } from "./connection";
import { alerts, entities } from "@workspace/db";

export type { } from "@workspace/db";

export type NeonAlert = {
  id: string;
  entityId: string | null;
  entitySlug: string | null;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  metricValue: number | null;
  threshold: number | null;
  periodType: string | null;
  periodStart: string | null;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

function n(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : null;
}

type RawAlertRow = {
  id: string;
  entityId: string | null;
  entitySlug: string | null;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  metricValue: string | null;
  threshold: string | null;
  periodType: string | null;
  periodStart: string | null;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

function toNeonAlert(r: RawAlertRow): NeonAlert {
  return {
    ...r,
    metricValue: n(r.metricValue),
    threshold:   n(r.threshold),
  };
}

/**
 * All open alerts for one entity, ordered by severity then recency.
 * Joins entities to resolve slug for the frontend.
 */
export async function getAlertsByEntity(entityId: string): Promise<NeonAlert[]> {
  const rows = await db
    .select({
      id:          alerts.id,
      entityId:    alerts.entityId,
      entitySlug:  entities.slug,
      alertType:   alerts.alertType,
      severity:    alerts.severity,
      title:       alerts.title,
      message:     alerts.message,
      metricValue: alerts.metricValue,
      threshold:   alerts.threshold,
      periodType:  alerts.periodType,
      periodStart: alerts.periodStart,
      status:      alerts.status,
      firstSeenAt: alerts.firstSeenAt,
      lastSeenAt:  alerts.lastSeenAt,
    })
    .from(alerts)
    .leftJoin(entities, eq(alerts.entityId, entities.id))
    .where(and(eq(alerts.entityId, entityId), ne(alerts.status, "resolved")))
    .orderBy(desc(alerts.lastSeenAt));

  return rows.map(toNeonAlert);
}

/**
 * All open alerts across all entities, for the portfolio alerts view.
 * Portfolio-level alerts (entity_id IS NULL) are included.
 */
export async function getAllActiveAlerts(): Promise<NeonAlert[]> {
  const rows = await db
    .select({
      id:          alerts.id,
      entityId:    alerts.entityId,
      entitySlug:  entities.slug,
      alertType:   alerts.alertType,
      severity:    alerts.severity,
      title:       alerts.title,
      message:     alerts.message,
      metricValue: alerts.metricValue,
      threshold:   alerts.threshold,
      periodType:  alerts.periodType,
      periodStart: alerts.periodStart,
      status:      alerts.status,
      firstSeenAt: alerts.firstSeenAt,
      lastSeenAt:  alerts.lastSeenAt,
    })
    .from(alerts)
    .leftJoin(entities, eq(alerts.entityId, entities.id))
    .where(ne(alerts.status, "resolved"))
    .orderBy(desc(alerts.lastSeenAt));

  return rows.map(toNeonAlert);
}
