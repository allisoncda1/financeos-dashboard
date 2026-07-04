import { pgTable, uuid, text, date, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { syncRuns } from "./sync";

export const validationResults = pgTable("validation_results", {
  id:           uuid("id").primaryKey().defaultRandom(),
  // Nullable: null means portfolio-level validation, not entity-specific
  entityId:     uuid("entity_id").references(() => entities.id),
  syncRunId:    uuid("sync_run_id").references(() => syncRuns.id),
  runDate:      timestamp("run_date", { withTimezone: true }).notNull().defaultNow(),
  totalChecks:  integer("total_checks").notNull().default(0),
  passed:       integer("passed").notNull().default(0),
  failed:       integer("failed").notNull().default(0),
  // Written by application — equals (failed = 0)
  allPassed:    boolean("all_passed").notNull().default(false),
  ruleResults:  jsonb("rule_results").notNull().default([]),
}, (t) => [
  index("idx_validation_results_entity").on(t.entityId, t.runDate),
]);

export const reportSnapshots = pgTable("report_snapshots", {
  id:           uuid("id").primaryKey().defaultRandom(),
  template:     text("template").notNull(),
  entityIds:    uuid("entity_ids").array().notNull(),
  periodStart:  date("period_start"),
  periodEnd:    date("period_end"),
  format:       text("format").notNull(),
  title:        text("title").notNull(),
  // Populated only for format='json'; binary formats stored in Google Drive
  content:      jsonb("content"),
  driveFileId:  text("drive_file_id"),
  driveUrl:     text("drive_url"),
  generatedAt:  timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  generatedBy:  text("generated_by").default("system"),
}, (t) => [
  index("idx_report_snapshots_template").on(t.template, t.generatedAt),
]);

export const auditLog = pgTable("audit_log", {
  id:        uuid("id").primaryKey().defaultRandom(),
  entityId:  uuid("entity_id").references(() => entities.id),
  action:    text("action").notNull(),
  actor:     text("actor").notNull().default("system"),
  details:   jsonb("details").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_audit_log_entity").on(t.entityId, t.createdAt),
  index("idx_audit_log_action").on(t.action, t.createdAt),
]);

export type ValidationResult = typeof validationResults.$inferSelect;
export type InsertValidationResult = typeof validationResults.$inferInsert;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
export type InsertReportSnapshot = typeof reportSnapshots.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
