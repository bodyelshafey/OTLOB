import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // The Prisma CLI (generate/validate/migrate) needs a direct,
    // non-pooled connection — DIRECT_URL (Supabase port 5432) when it's
    // set. Falls back to DATABASE_URL for local/dev setups that only
    // define one URL (e.g. a plain local Postgres instance, as in this
    // repro .env). This was previously hardcoded to DATABASE_URL, which
    // in production points at the Supavisor transaction pooler
    // (port 6543, pgbouncer=true) per .env.example — running
    // `prisma migrate deploy`/`generate` against that pooled connection
    // is unsupported (pgbouncer transaction-mode pooling doesn't support
    // the advisory locks Migrate needs). See .env.example's DATABASE_URL/
    // DIRECT_URL comments for the intended split; PrismaService (runtime)
    // is unaffected — it always reads DATABASE_URL directly.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});