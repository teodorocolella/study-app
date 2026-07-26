import { createApp } from "./app.js";
import { env } from "./env.js";
import { startReminderJob } from "./jobs/reminderJob.js";
import { pushEnabled } from "./services/push.service.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
  startReminderJob();
  console.log(`Push notifications ${pushEnabled ? "enabled" : "disabled — VAPID keys not configured"}`);
});
