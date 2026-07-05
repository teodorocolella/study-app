import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  CLIENT_ORIGIN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
