import { useEffect, useState } from "react";
import { api } from "../../api/client";

// Full-page redirect into the server OAuth flow (same-origin in prod, proxied in dev).
function startOAuth(provider: string) {
  window.location.href = `/api/auth/oauth/${provider}`;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const PROVIDER_META: Record<string, { label: string; icon: React.FC }> = {
  google: { label: "Continue with Google", icon: GoogleIcon },
  microsoft: { label: "Continue with Microsoft", icon: MicrosoftIcon },
};

export function SocialSignIn() {
  const [providers, setProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get<Record<string, boolean>>("/auth/providers").then(setProviders).catch(() => {});
  }, []);

  const enabled = Object.keys(PROVIDER_META).filter((p) => providers[p]);
  if (enabled.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="space-y-2">
        {enabled.map((p) => {
          const meta = PROVIDER_META[p];
          const Icon = meta.icon;
          return (
            <button
              key={p}
              type="button"
              onClick={() => startOAuth(p)}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Icon />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
