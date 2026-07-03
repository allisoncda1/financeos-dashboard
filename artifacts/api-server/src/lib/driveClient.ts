import { google, type drive_v3 } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

let cachedClient: OAuth2Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDriveClient(): OAuth2Client {
  if (cachedClient) return cachedClient;

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_REFRESH_TOKEN");

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });

  cachedClient = client;
  return cachedClient;
}

export function getDrive(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getDriveClient() });
}
