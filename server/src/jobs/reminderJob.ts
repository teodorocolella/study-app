import cron from "node-cron";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { emailEnabled, reminderEmailHtml, sendEmail } from "../services/email.service.js";
import { getDashboardSummary } from "../services/review.service.js";

/**
 * Emails every student who has cards due but hasn't studied yet today.
 * Runs on REMINDER_CRON (default 4pm server time, daily).
 */
export async function sendDueCardReminders() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, displayName: true } });
  let sent = 0;

  for (const user of users) {
    try {
      const summary = await getDashboardSummary(user.id);
      if (summary.totalDue === 0 || summary.studiedToday > 0) continue;
      await sendEmail(
        user.email,
        `${summary.totalDue} flashcard${summary.totalDue === 1 ? "" : "s"} ready for review 📚`,
        reminderEmailHtml(user.displayName, summary.totalDue, summary.streak),
      );
      sent++;
    } catch (err) {
      console.error(`Reminder email failed for ${user.email}:`, err);
    }
  }

  console.log(`Reminder job finished: ${sent} reminder${sent === 1 ? "" : "s"} ${emailEnabled ? "sent" : "logged (SMTP not configured)"}`);
}

export function startReminderJob() {
  if (!cron.validate(env.REMINDER_CRON)) {
    console.error(`Invalid REMINDER_CRON "${env.REMINDER_CRON}" — reminder job not scheduled`);
    return;
  }
  cron.schedule(env.REMINDER_CRON, () => {
    void sendDueCardReminders();
  });
  console.log(
    `Reminder job scheduled (${env.REMINDER_CRON})${emailEnabled ? "" : " — SMTP not configured, reminders will only be logged"}`,
  );
}
