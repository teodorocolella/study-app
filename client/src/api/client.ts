const API_BASE = "/api";

type AccessTokenGetter = () => string | null;
type AccessTokenSetter = (token: string | null) => void;

let getAccessToken: AccessTokenGetter = () => null;
let setAccessToken: AccessTokenSetter = () => {};

export function configureApiClient(getter: AccessTokenGetter, setter: AccessTokenSetter) {
  getAccessToken = getter;
  setAccessToken = setter;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: "include",
  });

  if (res.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * POSTs to a server-sent-events endpoint and invokes onEvent for each
 * `data: {...}` JSON payload as it streams in.
 */
async function streamRequest(
  path: string,
  body: unknown,
  onEvent: (event: unknown) => void,
  signal?: AbortSignal,
  retry = true,
): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return streamRequest(path, body, onEvent, signal, false);
    }
  }

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errBody.error ?? "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          // Skip malformed chunks rather than killing the stream.
        }
      }
    }
  }
}

/**
 * Opens a live GET server-sent-events stream (auth via header, since native
 * EventSource can't send one) and calls onEvent for each `data: {...}`
 * payload. Auto-refreshes the access token on a 401 and auto-reconnects if
 * the connection drops, until the returned close function is called.
 */
function liveStream(path: string, onEvent: (event: unknown) => void): () => void {
  let closed = false;
  let controller: AbortController | null = null;

  async function connect(retryAuth = true): Promise<void> {
    if (closed) return;
    controller = new AbortController();
    const token = getAccessToken();
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        signal: controller.signal,
      });

      if (res.status === 401 && retryAuth) {
        const refreshed = await tryRefresh();
        if (refreshed && !closed) return connect(false);
        return;
      }
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              onEvent(JSON.parse(line.slice(6)));
            } catch {
              // Skip malformed chunks.
            }
          }
        }
      }
    } catch {
      // Aborted (intentional close) or a network blip — reconnect handles the latter.
    }
    if (!closed) setTimeout(() => void connect(true), 2000);
  }

  void connect();
  return () => {
    closed = true;
    controller?.abort();
  };
}

// Whether object storage is configured, fetched once and cached.
let uploadsEnabled: boolean | null = null;

/**
 * Uploads an image data URL to object storage when it's configured, returning
 * a hosted URL; otherwise returns the data URL unchanged (inline fallback).
 */
async function uploadImage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  if (uploadsEnabled === null) {
    uploadsEnabled = await request<{ enabled: boolean }>("/uploads/status")
      .then((r) => r.enabled)
      .catch(() => false);
  }
  if (!uploadsEnabled) return dataUrl;
  try {
    const { url } = await request<{ url: string }>("/uploads", {
      method: "POST",
      body: JSON.stringify({ dataUrl }),
    });
    return url;
  } catch {
    return dataUrl; // fall back to inline on any upload failure
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  uploadImage,
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  stream: streamRequest,
  liveStream,
};
