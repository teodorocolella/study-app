/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Precache the built app shell (vite-plugin-pwa injects the manifest here).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Serve the app shell for client-side routes when offline.
registerRoute(
  ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/api"),
  new NetworkFirst({ cacheName: "study-hub-shell" }),
);

// Notes, classes, and decks stay readable offline after a first view.
registerRoute(
  ({ url }) => /\/api\/(notes|classes|decks)\/.*/.test(url.pathname),
  new NetworkFirst({
    cacheName: "study-hub-api",
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
);

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());

// --- Web Push ---

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? "/dashboard";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((c) => "focus" in c);
      if (existing) {
        await (existing as WindowClient).focus();
        existing.postMessage({ type: "navigate", url: targetUrl });
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
