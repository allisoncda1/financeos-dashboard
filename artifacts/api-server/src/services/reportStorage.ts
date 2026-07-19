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
 *
 * API notes (@replit/object-storage@1.0.0):
 *   - All methods return a Result<T> discriminated union: { ok: true; value: T } | { ok: false; error }
 *   - uploadFromBytes(key, buf, opts?) — opts only accepts { compress?: boolean }, NOT contentType
 *   - downloadAsBytes(key) returns Result<[Buffer]> — value is a 1-tuple, access [0]
 *   - list() returns Result<StorageObject[]> — check .ok before using
 *   - Content type is derived from the storage key extension on retrieval
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

// ─── Content-type helper ─────────────────────────────────────────────────────

function contentTypeFromKey(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase() ?? "bin";
  if (ext === "pdf")  return "application/pdf";
  if (ext === "html") return "text/html; charset=utf-8";
  return "application/octet-stream";
}

// ─── Storage key generation ───────────────────────────────────────────────────

/**
 * Generates a deterministic storage key for a report artifact.
 * Keys are always constructed server-side — never accepted from user input.
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

// ─── Replit Object Storage client (lazy-loaded, null when not configured) ─────

let _client: ReplitStorageClient | null = null;
let _clientInit = false;

/** Minimal surface we use from @replit/object-storage Client. */
interface ReplitStorageClient {
  upload(key: string, data: Buffer): Promise<void>;
  download(key: string): Promise<Buffer>;
}

async function getReplitClient(): Promise<ReplitStorageClient | null> {
  if (_clientInit) return _client;
  _clientInit = true;

  try {
    // Dynamic import — server starts cleanly when the package is absent
    // or when Replit Object Storage is not provisioned.
    const mod = await import("@replit/object-storage" as string);
    const raw = new mod.Client();

    // Probe: list() returns Result<StorageObject[]>; a failed probe means
    // the bucket is not provisioned in this runtime environment.
    const probe = await raw.list();
    if (!probe.ok) {
      const detail = (probe.error as Error | undefined)?.message ?? String(probe.error);
      throw new Error(`Bucket not available: ${detail}`);
    }

    _client = {
      async upload(key: string, data: Buffer): Promise<void> {
        // UploadOptions only supports { compress?: boolean } — no contentType field.
        // Content type is derived from the key extension on retrieval.
        const result = await raw.uploadFromBytes(key, data);
        if (!result.ok) {
          const detail = (result.error as Error | undefined)?.message ?? String(result.error);
          throw new Error(`Upload failed: ${detail}`);
        }
      },

      async download(key: string): Promise<Buffer> {
        // downloadAsBytes returns Result<[Buffer]> — value is a 1-tuple.
        const result = await raw.downloadAsBytes(key);
        if (!result.ok) {
          const detail = (result.error as Error | undefined)?.message ?? String(result.error);
          throw new Error(`Download failed: ${detail}`);
        }
        // result.value is [Buffer] — unpack the first (and only) element.
        return result.value[0];
      },
    };

    console.info("[ReportStorage] Replit Object Storage client ready");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[ReportStorage] Replit Object Storage unavailable — artifacts will not be persisted. ` +
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
      reason: "No object-storage backend configured. Provision Replit Object Storage to enable.",
    };
  }

  try {
    await client.upload(storageKey, opts.data);
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
    const data = await client.download(storageKey);
    const contentType = contentTypeFromKey(storageKey);
    const fileName = storageKey.split("/").pop() ?? `report`;
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
