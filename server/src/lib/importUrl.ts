import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ApiError } from "../middleware/errorHandler.js";

// Google Docs/Slides/Sheets share links → their public plain-text export URL.
const GOOGLE_DOC = /^https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_SLIDES = /^https?:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;
const GOOGLE_SHEETS = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

const MAX_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

function googleShareHelp(kind: string): string {
  return `That Google ${kind} isn't shared, so the app can't read it. Open it, click Share → General access → "Anyone with the link" (Viewer), then paste the link again.`;
}

type Target = { fetchUrl: string; google: "Doc" | "Slides" | "Sheet" | null };

function resolveTarget(rawUrl: string): Target {
  let m: RegExpExecArray | null;
  if ((m = GOOGLE_DOC.exec(rawUrl)))
    return { fetchUrl: `https://docs.google.com/document/d/${m[1]}/export?format=txt`, google: "Doc" };
  if ((m = GOOGLE_SLIDES.exec(rawUrl)))
    return { fetchUrl: `https://docs.google.com/presentation/d/${m[1]}/export/txt`, google: "Slides" };
  if ((m = GOOGLE_SHEETS.exec(rawUrl)))
    return { fetchUrl: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`, google: "Sheet" };
  return { fetchUrl: rawUrl, google: null };
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return false;
  }
  if (version === 6) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true;
    const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

// Guard arbitrary user links against SSRF: only http(s), and never a private,
// loopback, or link-local address (checked after DNS resolution too).
async function assertPublicUrl(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ApiError(400, "Only http and https links can be imported.");
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal")
  ) {
    throw new ApiError(400, "That link points to a private address, which can't be imported.");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new ApiError(400, "That link points to a private address, which can't be imported.");
    }
    return;
  }
  let addrs;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new ApiError(400, "Couldn't find that website. Check the link and try again.");
  }
  if (addrs.some((a) => isPrivateIp(a.address))) {
    throw new ApiError(400, "That link points to a private address, which can't be imported.");
  }
}

function looksLikeHtml(s: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(s);
}

/** Rough HTML → text: drop scripts/styles/chrome, strip tags, decode basics. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|head|nav|footer|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetches readable text from a public URL — a Google Doc/Slides/Sheet (via its
 * plain-text export) or any public web page — for the Claude note importer.
 */
export async function fetchTextFromUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ApiError(400, "That doesn't look like a valid link.");
  }

  const { fetchUrl, google } = resolveTarget(parsed.toString());
  // Google export URLs hit the trusted docs.google.com host; only vet arbitrary links.
  if (!google) await assertPublicUrl(parsed);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StudyHubImporter/1.0)",
        Accept: "text/html,text/plain,application/xhtml+xml,*/*",
      },
    });
  } catch {
    throw new ApiError(400, "Couldn't load that link — it may be offline or blocking requests.");
  } finally {
    clearTimeout(timer);
  }

  // A private Google doc bounces the export to the sign-in page.
  if (google && /accounts\.google\.com|\/ServiceLogin/i.test(res.url)) {
    throw new ApiError(400, googleShareHelp(google));
  }
  if (!res.ok) {
    if (google && [401, 403, 404].includes(res.status)) throw new ApiError(400, googleShareHelp(google));
    throw new ApiError(400, `That link returned an error (HTTP ${res.status}).`);
  }

  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) throw new ApiError(400, "That page is too large to import.");

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const body = await res.text();
  if (body.length > MAX_BYTES) throw new ApiError(400, "That page is too large to import.");

  let text: string;
  if (google) {
    if (looksLikeHtml(body)) throw new ApiError(400, googleShareHelp(google));
    text = body;
  } else if (contentType.includes("text/html") || looksLikeHtml(body)) {
    text = htmlToText(body);
  } else if (contentType.includes("text/") || contentType.includes("csv") || contentType.includes("json")) {
    text = body;
  } else {
    throw new ApiError(400, "That link isn't a document or web page the importer can read.");
  }

  text = text.replace(/\r\n/g, "\n").trim();
  if (text.length < 20) throw new ApiError(400, "Couldn't find enough readable text at that link.");
  return text.slice(0, 100_000); // keep the payload to Claude reasonable
}
