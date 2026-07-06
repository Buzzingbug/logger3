import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../packages/db/src/schema";

export * from "../../../packages/db/src/schema";

export function createWebDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}
