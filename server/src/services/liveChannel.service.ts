import { EventEmitter } from "node:events";

// In-process pub/sub for live chat updates (new messages, typing) and simple
// presence tracking (who's actively viewing a channel right now, so we know
// who to skip when sending push notifications). Single-Node-process scoped —
// fine for this app's single Render Web Service; would need a shared bus
// (e.g. Redis pub/sub) if it ever ran multiple instances.

export type LiveEvent =
  | { type: "message"; message: unknown }
  | { type: "typing"; userId: string; name: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

const activeViewers = new Map<string, Set<string>>();

export function groupChannel(groupId: string): string {
  return `group:${groupId}`;
}

export function dmChannel(userIdA: string, userIdB: string): string {
  return `dm:${[userIdA, userIdB].sort().join(":")}`;
}

export function publish(channel: string, event: LiveEvent): void {
  emitter.emit(channel, event);
}

export function subscribe(channel: string, listener: (event: LiveEvent) => void): () => void {
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}

export function markActive(channel: string, userId: string): void {
  let set = activeViewers.get(channel);
  if (!set) {
    set = new Set();
    activeViewers.set(channel, set);
  }
  set.add(userId);
}

export function markInactive(channel: string, userId: string): void {
  const set = activeViewers.get(channel);
  if (!set) return;
  set.delete(userId);
  if (set.size === 0) activeViewers.delete(channel);
}

export function isActive(channel: string, userId: string): boolean {
  return activeViewers.get(channel)?.has(userId) ?? false;
}
