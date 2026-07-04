import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export default defineConfig({
  schema:      "./src/schema/index.ts",
  out:         "./drizzle/migrations",
  dialect:     "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
