import { isActive } from "./liveChannel.service.js";
import { sendPushToUser, type PushPayload } from "./push.service.js";

/**
 * Sends a push notification to each recipient who isn't currently viewing
 * the given live channel (they already see the message appear live, so a
 * push would be redundant). No-op per recipient if they have no subscriptions
 * or push isn't configured.
 */
export async function notifyOfflineMembers(
  channel: string,
  recipientIds: string[],
  payload: PushPayload,
): Promise<void> {
  await Promise.all(
    recipientIds
      .filter((userId) => !isActive(channel, userId))
      .map((userId) => sendPushToUser(userId, payload)),
  );
}
