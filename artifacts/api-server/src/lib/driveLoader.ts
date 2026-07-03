import { getDrive } from "./driveClient";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function findChildIdByName(
  parentId: string,
  name: string,
  sharedDriveId: string,
): Promise<string> {
  const drive = getDrive();
  const escapedName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and trashed = false`,
    fields: "files(id, name, mimeType)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "drive",
    driveId: sharedDriveId,
    spaces: "drive",
    pageSize: 10,
  });

  const files = res.data.files ?? [];
  const match = files[0];
  if (!match?.id) {
    throw new Error(`Drive item "${name}" not found under parent "${parentId}"`);
  }
  return match.id;
}

async function resolveFileId(relativePath: string): Promise<string> {
  const sharedDriveId = requireEnv("GOOGLE_SHARED_DRIVE_ID");
  const rootFolderId = requireEnv("FINANCEOS_DATA_MODEL_FOLDER_ID");

  const segments = relativePath.split("/").filter(Boolean);
  let currentParentId = rootFolderId;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as string;
    currentParentId = await findChildIdByName(currentParentId, segment, sharedDriveId);
  }

  return currentParentId;
}

async function downloadJsonFile(fileId: string): Promise<unknown> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" },
  );
  const raw = res.data as unknown as string;
  return JSON.parse(raw);
}

export async function driveLoadJson<T>(relativePath: string): Promise<T> {
  const cached = cache.get(relativePath);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const fileId = await resolveFileId(relativePath);
  const data = await downloadJsonFile(fileId);

  cache.set(relativePath, { value: data, expiresAt: now + CACHE_TTL_MS });
  return data as T;
}

export function driveStatus(): { configured: boolean; cacheSize: number } {
  const configured = Boolean(
    process.env["GOOGLE_CLIENT_ID"] &&
      process.env["GOOGLE_REFRESH_TOKEN"] &&
      process.env["GOOGLE_SHARED_DRIVE_ID"] &&
      process.env["FINANCEOS_DATA_MODEL_FOLDER_ID"],
  );
  return { configured, cacheSize: cache.size };
}
