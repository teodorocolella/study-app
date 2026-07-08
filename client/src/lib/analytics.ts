declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", { page_path: path });
}
