import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(databaseUrl = process.env.DATABASE_URL): Database {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}
