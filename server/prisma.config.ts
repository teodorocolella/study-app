import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` (run during the build) does pure code generation and never
// connects to a database, so it must not require DATABASE_URL. Every other
// command (migrate deploy, etc.) genuinely needs a real database, so fail there
// with a clear message instead of silently trying a placeholder host.
const isGenerate = process.argv.includes("generate");
const url = process.env.DATABASE_URL;

if (!url && !isGenerate) {
  throw new Error(
    "DATABASE_URL is not set. Add it in your host's environment settings (on Render: the " +
      "web service → Environment → the Postgres connection string) before running migrations.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Placeholder only reached during codegen, which never connects.
    url: url || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
