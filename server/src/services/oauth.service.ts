import { env } from "../env.js";

// Pluggable OAuth: add a provider by dropping another entry in PROVIDERS.
// Each provider is enabled only when its client id + secret are configured,
// so the app runs fine with none set.

export interface OAuthProfile {
  email: string;
  displayName: string;
}

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  parseProfile: (userinfo: Record<string, unknown>) => OAuthProfile | null;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    parseProfile: (u) => {
      const email = typeof u.email === "string" ? u.email : null;
      if (!email) return null;
      const name = typeof u.name === "string" && u.name ? u.name : email.split("@")[0];
      return { email, displayName: name };
    },
  },
  microsoft: {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
    parseProfile: (u) => {
      const email =
        (typeof u.email === "string" && u.email) ||
        (typeof u.preferred_username === "string" && u.preferred_username) ||
        null;
      if (!email) return null;
      const name = typeof u.name === "string" && u.name ? u.name : email.split("@")[0];
      return { email, displayName: name };
    },
  },
};

export function isProviderEnabled(provider: string): boolean {
  const p = PROVIDERS[provider];
  return Boolean(p?.clientId && p?.clientSecret);
}

export function enabledProviders(): Record<string, boolean> {
  return Object.fromEntries(Object.keys(PROVIDERS).map((k) => [k, isProviderEnabled(k)]));
}

function redirectUri(provider: string) {
  return `${env.APP_URL}/api/auth/oauth/${provider}/callback`;
}

export function buildAuthorizationUrl(provider: string, state: string): string {
  const p = PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: p.clientId!,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: p.scope,
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `${p.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForProfile(provider: string, code: string): Promise<OAuthProfile> {
  const p = PROVIDERS[provider];

  const tokenRes = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: p.clientId!,
      client_secret: p.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(provider),
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("No access token from provider");

  const userRes = await fetch(p.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) throw new Error(`Userinfo failed (${userRes.status})`);
  const profile = p.parseProfile((await userRes.json()) as Record<string, unknown>);
  if (!profile) throw new Error("Provider did not return an email");
  return profile;
}
