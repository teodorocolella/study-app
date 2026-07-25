import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "installHintDismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Nudges users to install the PWA. On Android/desktop Chrome it fires the
 * native install prompt; on iOS Safari (no prompt API) it explains the
 * Share → Add to Home Screen steps.
 */
export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    // Android / desktop Chrome: capture the install prompt.
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari has no prompt event — show the manual instructions instead.
    if (isIos()) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[min(320px,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
          <Download className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Add Study Hub to your phone
          </p>
          {deferred ? (
            <>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Install it as an app for one-tap access and offline notes.
              </p>
              <button
                onClick={() => void install()}
                className="mt-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                Install app
              </button>
            </>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              In Safari, tap the Share button{" "}
              <Share className="inline h-3.5 w-3.5 -translate-y-px text-violet-500" /> at the bottom,
              then <strong>Add to Home Screen</strong> to use it like an app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
