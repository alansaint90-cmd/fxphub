import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/fausto_dev";
const client = postgres(databaseUrl, { prepare: false });

export const db = drizzle(client, { schema });
export type Database = typeof db;
