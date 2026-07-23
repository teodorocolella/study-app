import nodemailer from "nodemailer";
import { env } from "../env.js";

// Email is optional: with no SMTP config the app runs fine and reminder
// sends become log lines, so local dev never needs credentials.
export const emailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transport = emailEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!transport) {
    console.log(`[email disabled] Would send to ${to}: ${subject}`);
    return;
  }
  await transport.sendMail({
    from: env.EMAIL_FROM ?? env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export function reminderEmailHtml(displayName: string, dueCount: number, streak: number) {
  const streakLine =
    streak > 0
      ? `<p style="margin:0 0 16px">You're on a <strong>${streak}-day streak</strong> — a quick review today keeps it alive. 🔥</p>`
      : "";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:16px;padding:28px;color:#fff">
      <h1 style="margin:0 0 8px;font-size:22px">Hi ${displayName} 👋</h1>
      <p style="margin:0;font-size:15px;color:#ede9fe">
        You have <strong>${dueCount} flashcard${dueCount === 1 ? "" : "s"}</strong> ready for review on Study Hub.
      </p>
    </div>
    <div style="padding:24px 4px">
      ${streakLine}
      <p style="margin:0 0 20px">A few minutes of spaced repetition today beats an hour of cramming later.</p>
      <a href="${env.APP_URL}/study"
         style="display:inline-block;background:linear-gradient(90deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">
        Review now
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Study Hub · your AI-powered study companion</p>
    </div>
  </div>`;
}
