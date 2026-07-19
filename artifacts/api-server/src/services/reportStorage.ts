/**
 * Report Artifact Storage Service
 *
 * Provides a clean abstraction over object storage for generated HTML/PDF reports.
 * Supports Replit Object Storage when configured; degrades honestly when not.
 *
 * Security:
 *   - Storage keys are system-generated UUIDs, never accepted from user input.
 *   - No signed URLs or credentials are written to logs.
 *   - Access is always mediated through authenticated API endpoints.
 *   - Entity isolation is enforced at the API layer before calling this service.
 */

import { createHash } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StorageProvider = "replit-object-storage" | "local-fs" | "none";

export type StoreArtifactResult =
  | {
      stored: true;
      provider: StorageProvider;
      storageKey: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      checksum: string;
      storedAt: Date;
    }
  | {
      stored: false;
      reason: string;
    };

export type GetArtifactResult =
  | { available: true; data: Buffer; contentType: string; fileName: string }
  | { available: false; reason: string };

// ─── Checksum helper ─────────────────────────────────────────────────────────

function sha256hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ─── Storage key generation ───────────────────────────────────────────────────

/**
 * Generates a deterministic, unpredictable storage key for a report artifact.
 * Keys are never accepted from user input — always constructed server-side.
 */
export function buildStorageKey(opts: {
  historyId: string;
  templateId: string;
  period: string;
  format: string;
}): string {
  const periodSlug = opts.period.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 20);
  return `reports/${opts.templateId}/${periodSlug}/${opts.historyId}.${opts.format}`;
}

// ─── Replit Object Storage client (lazy-loaded, nil when not configured) ─────

let _client: ReplitStorageClient | null = null;
let _clientInit = false;

interface ReplitStorageClient {
  uploadFromBytes(key: string, data: Buffer, contentType: string): Promise<void>;
  downloadAsBytes(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

async function getReplitClient(): Promise<ReplitStorageClient | null> {
  if (_clientInit) return _client;
  _clientInit = true;

  // Replit Object Storage is available when @replit/object-storage is installed
  // and REPLIT_DB_URL / OBJECT_STORAGE_BUCKET is set by the Replit runtime.
  try {
    // Dynamic import so the server starts cleanly without the package
    const mod = await import("@replit/object-storage" as string);
    const client = new mod.Client();
    await client.list(); // lightweight probe — fails fast if not configured
    _client = {
      async uploadFromBytes(key, data, contentType) {
        await client.uploadFromBytes(key, data, { contentType });
      },
      async downloadAsBytes(key) {
        const result = await client.downloadAsBytes(key);
        if (!result.ok) throw new Error(`Storage download failed: ${result.error?.message}`);
        return Buffer.from(result.value);
      },
      async delete(key) {
        await client.delete(key);
      },
    };
    console.info("[ReportStorage] Replit Object Storage client ready");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[ReportStorage] Replit Object Storage unavailable — artifacts will not be persisted. ` +
        `To enable: install @replit/object-storage and ensure REPLIT runtime is active. ` +
        `Detail: ${msg}`,
    );
    _client = null;
  }

  return _client;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a generated report artifact. Returns honest unavailable state if no
 * storage backend is configured — never throws.
 */
export async function storeArtifact(opts: {
  historyId: string;
  templateId: string;
  period: string;
  format: "html" | "pdf";
  fileName: string;
  data: Buffer;
}): Promise<StoreArtifactResult> {
  const checksum = sha256hex(opts.data);
  const contentType = opts.format === "pdf" ? "application/pdf" : "text/html; charset=utf-8";
  const storageKey = buildStorageKey({
    historyId:  opts.historyId,
    templateId: opts.templateId,
    period:     opts.period,
    format:     opts.format,
  });

  const client = await getReplitClient();
  if (!client) {
    return {
      stored: false,
      reason: "No object-storage backend configured. Install @replit/object-storage and enable in Replit.",
    };
  }

  try {
    await client.uploadFromBytes(storageKey, opts.data, contentType);
    return {
      stored:      true,
      provider:    "replit-object-storage",
      storageKey,
      fileName:    opts.fileName,
      contentType,
      fileSize:    opts.data.length,
      checksum,
      storedAt:    new Date(),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ReportStorage] Upload failed for ${storageKey}: ${msg}`);
    return { stored: false, reason: `Upload failed: ${msg}` };
  }
}

/**
 * Retrieve a stored report artifact by its storage key.
 * The storageKey must come from the database row — never from user input.
 */
export async function retrieveArtifact(storageKey: string): Promise<GetArtifactResult> {
  const client = await getReplitClient();
  if (!client) {
    return { available: false, reason: "No object-storage backend configured." };
  }

  try {
    const data = await client.downloadAsBytes(storageKey);
    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "bin";
    const contentType =
      ext === "pdf"  ? "application/pdf" :
      ext === "html" ? "text/html; charset=utf-8" :
                       "application/octet-stream";
    const fileName = storageKey.split("/").pop() ?? `report.${ext}`;
    return { available: true, data, contentType, fileName };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { available: false, reason: `Artifact retrieval failed: ${msg}` };
  }
}

/**
 * Returns whether an object-storage backend is currently available.
 * Used by health checks and UI to set honest expectations.
 */
export async function isStorageAvailable(): Promise<boolean> {
  const client = await getReplitClient();
  return client !== null;
}
