import { createApp } from "./app.js";
import { env } from "./env.js";
import { startReminderJob } from "./jobs/reminderJob.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
  startReminderJob();
});
