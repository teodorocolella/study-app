import { Bell, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getExistingSubscription, getPushConfig, isPushSupported, subscribeToPush } from "../../lib/push";

const DISMISSED_KEY = "notificationsPromptDismissed";
const INSTALL_HINT_KEY = "installHintDismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** A one-time dismissible banner offering to turn on push notifications for messages. */
export function NotificationsPrompt() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported() || localStorage.getItem(DISMISSED_KEY) === "1") return;
    if (typeof Notification !== "undefined" && Notification.permission !== "default") return;
    // Shares a corner with the install-to-home-screen hint — don't stack both
    // on a first visit; show this one only once that's been dealt with.
    if (!isStandalone() && localStorage.getItem(INSTALL_HINT_KEY) !== "1") return;

    Promise.all([getPushConfig(), getExistingSubscription()])
      .then(([config, existing]) => {
        if (config.enabled && config.publicKey && !existing) {
          setPublicKey(config.publicKey);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await subscribeToPush(publicKey);
      if (ok) {
        localStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
      } else {
        setError("Notifications weren't enabled — you can turn them on later in your profile.");
      }
    } catch {
      setError("Something went wrong enabling notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border border-violet-200 bg-white p-4 shadow-xl dark:border-violet-500/30 dark:bg-slate-800">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20">
          <Bell className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Turn on notifications?</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Get notified when a classmate messages you or your study group, even when Study Hub
            isn't open.
          </p>
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => void enable()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Turn on
            </button>
            <button
              onClick={dismiss}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
