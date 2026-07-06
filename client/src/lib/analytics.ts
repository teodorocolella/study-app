const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer.push(args);
}

export function initAnalytics() {
  if (!measurementId || typeof document === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

export function trackPageView(path: string) {
  if (!measurementId) return;
  gtag("event", "page_view", { page_path: path });
}
