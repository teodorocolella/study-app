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

  // Email reminders — all optional; reminders are disabled unless SMTP is configured.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  APP_URL: z.string().default("http://localhost:5173"),
  REMINDER_CRON: z.string().default("0 16 * * *"),

  // Social sign-in (optional). Each provider is enabled only when both id + secret are set.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),

  // Object storage for images (optional, S3-compatible: Cloudflare R2, AWS S3, …).
  // Enabled only when bucket + keys + public URL are all set; otherwise images
  // stay inline as data URLs (the default).
  S3_ENDPOINT: z.string().optional(), // e.g. https://<accountid>.r2.cloudflarestorage.com
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(), // public base URL for stored objects
});

export const env = envSchema.parse(process.env);
