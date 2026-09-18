import "dotenv/config";
import { defineConfig } from "prisma/config";

// IMPORTANT: don't use prisma's `env()` helper for the datasource url here.
// It throws (PrismaConfigEnvError) if DATABASE_URL is unset, and the config is
// loaded by *every* prisma command — including `prisma generate` during the
// build, where there is no database (codegen never connects). That breaks the
// deploy build. Read it plainly and fall back to a harmless placeholder; the
// real DATABASE_URL is present in the environment at runtime, when migrations
// actually run at server start.
const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
