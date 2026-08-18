/**
 * Commission Document Storage Service
 *
 * Same pattern as services/reportStorage.ts: private object storage via
 * Replit Object Storage, degrades honestly when not configured (never
 * throws from a missing backend), storage keys are always server-generated
 * UUIDs — never derived from user-supplied file names. No binary content
 * is ever written to PostgreSQL; only the storage key and a SHA-256
 * checksum are persisted there.
 */
import { createHash, randomUUID } from "crypto";

export type StorageProvider = "replit-object-storage" | "none";

export type StoreDocumentResult =
  | { stored: true; provider: StorageProvider; storageKey: string; sha256: string }
  | { stored: false; reason: string };

export function sha256hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Storage keys are always system-generated — never accept a user-supplied path. */
export function buildDocumentStorageKey(entityId: string): string {
  return `commission-documents/${entityId}/${randomUUID()}.pdf`;
}

let _client: ReplitStorageClient | null = null;
let _clientInit = false;

interface ReplitStorageClient {
  upload(key: string, data: Buffer): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

async function getReplitClient(): Promise<ReplitStorageClient | null> {
  if (_clientInit) return _client;
  _clientInit = true;
  try {
    const mod = await import("@replit/object-storage" as string);
    const raw = new mod.Client();
    const probe = await raw.list();
    if (!probe.ok) {
      const detail = (probe.error as Error | undefined)?.message ?? String(probe.error);
      throw new Error(`Bucket not available: ${detail}`);
    }
    _client = {
      async upload(key: string, data: Buffer): Promise<void> {
        const result = await raw.uploadFromBytes(key, data);
        if (!result.ok) {
          const detail = (result.error as Error | undefined)?.message ?? String(result.error);
          throw new Error(`Upload failed: ${detail}`);
        }
      },
      async download(key: string): Promise<Buffer> {
        const result = await raw.downloadAsBytes(key);
        if (!result.ok) {
          const detail = (result.error as Error | undefined)?.message ?? String(result.error);
          throw new Error(`Download failed: ${detail}`);
        }
        return result.value[0];
      },
      async delete(key: string): Promise<void> {
        const result = await raw.delete(key);
        if (!result.ok) {
          const detail = (result.error as Error | undefined)?.message ?? String(result.error);
          throw new Error(`Delete failed: ${detail}`);
        }
      },
    };
    console.info("[CommissionDocumentStorage] Replit Object Storage client ready");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[CommissionDocumentStorage] Replit Object Storage unavailable. Detail: ${msg}`);
    _client = null;
  }
  return _client;
}

/**
 * storeDocument — stores the raw PDF bytes under an entity-scoped,
 * server-generated key. Returns an honest `stored:false` when no backend
 * is configured — NEVER falls back to writing the file to local disk (no
 * permanent local write exists anywhere in this module). The caller
 * (routes/commissionDocuments.ts) is responsible for turning `stored:false`
 * into a 503 response BEFORE creating any database row — this function
 * itself never throws for a missing backend, only for a genuine upload
 * failure against an otherwise-available backend.
 */
export async function storeDocument(entityId: string, data: Buffer): Promise<StoreDocumentResult & { sha256: string }> {
  const sha256 = sha256hex(data);
  const client = await getReplitClient();
  if (!client) {
    return { stored: false, reason: "No object-storage backend configured.", sha256 };
  }
  const storageKey = buildDocumentStorageKey(entityId);
  try {
    await client.upload(storageKey, data);
    return { stored: true, provider: "replit-object-storage", storageKey, sha256 };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CommissionDocumentStorage] Upload failed: ${msg}`);
    return { stored: false, reason: `Upload failed: ${msg}`, sha256 };
  }
}

export async function retrieveDocument(storageKey: string): Promise<{ available: true; data: Buffer } | { available: false; reason: string }> {
  const client = await getReplitClient();
  if (!client) return { available: false, reason: "No object-storage backend configured." };
  try {
    const data = await client.download(storageKey);
    return { available: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { available: false, reason: `Retrieval failed: ${msg}` };
  }
}

/**
 * deleteDocument — a COMPENSATING action only. Used when the object was
 * successfully stored but the corresponding database row could not be
 * created (routes/commissionDocuments.ts), to avoid an orphaned object
 * with nothing in Postgres ever referencing it. Never used to fulfil an
 * "archive" or "delete" request from a user — archived documents keep
 * their stored bytes; see db/commissionDocuments.ts::archiveDocument.
 */
export async function deleteDocument(storageKey: string): Promise<{ deleted: true } | { deleted: false; reason: string }> {
  const client = await getReplitClient();
  if (!client) return { deleted: false, reason: "No object-storage backend configured." };
  try {
    await client.delete(storageKey);
    return { deleted: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CommissionDocumentStorage] Compensating delete failed for ${storageKey}: ${msg}`);
    return { deleted: false, reason: msg };
  }
}

export async function isDocumentStorageAvailable(): Promise<boolean> {
  return (await getReplitClient()) !== null;
}
