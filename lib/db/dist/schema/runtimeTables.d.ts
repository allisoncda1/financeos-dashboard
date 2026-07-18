/**
 * These two tables are created at runtime by the api-server (see
 * `artifacts/api-server/src/app.ts` for "session" and
 * `artifacts/api-server/src/lib/snapshotStore.ts` for "metric_snapshots").
 * They are mirrored here so `drizzle-kit push` recognizes them and does not
 * propose dropping them (which would destroy live sessions and archived
 * metric history). Keep these definitions in sync with the runtime DDL.
 */
export declare const sessionTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "session";
    schema: undefined;
    columns: {
        sid: import("drizzle-orm/pg-core").PgColumn<{
            name: "sid";
            tableName: "session";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        sess: import("drizzle-orm/pg-core").PgColumn<{
            name: "sess";
            tableName: "session";
            dataType: "json";
            columnType: "PgJson";
            data: unknown;
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expire: import("drizzle-orm/pg-core").PgColumn<{
            name: "expire";
            tableName: "session";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const metricSnapshotsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "metric_snapshots";
    schema: undefined;
    columns: {
        slug: import("drizzle-orm/pg-core").PgColumn<{
            name: "slug";
            tableName: "metric_snapshots";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        month: import("drizzle-orm/pg-core").PgColumn<{
            name: "month";
            tableName: "metric_snapshots";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        asOf: import("drizzle-orm/pg-core").PgColumn<{
            name: "as_of";
            tableName: "metric_snapshots";
            dataType: "string";
            columnType: "PgDateString";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        metrics: import("drizzle-orm/pg-core").PgColumn<{
            name: "metrics";
            tableName: "metric_snapshots";
            dataType: "json";
            columnType: "PgJsonb";
            data: unknown;
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        capturedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "captured_at";
            tableName: "metric_snapshots";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type MetricSnapshotRow = typeof metricSnapshotsTable.$inferSelect;
//# sourceMappingURL=runtimeTables.d.ts.map