// Server-only, independently-verified page extraction via the fixed r.jina.ai
// reader origin.
//
// SECURITY MODEL
// - The ONLY outbound host we ever call is https://r.jina.ai (fixed origin).
// - We NEVER fetch the visitor's URL directly. We pass a normalized public
//   HTTP(S) URL to r.jina.ai as a path suffix.
// - Before calling, validatePublicWebsiteUrl() rejects: non-http(s) schemes,
//   embedded credentials, IP literals (v4/v6), nonstandard ports, localhost,
//   single-label / local / internal names, and strips query + fragment.
// - The outbound r.jina.ai request uses redirect: "error" so any HTTP redirect
//   on our side aborts (r.jina.ai follows the target URL itself, but we do not
//   follow intermediate redirects of the reader endpoint).
// - After extraction we require data.url to match the input hostname with only
//   www <-> apex equivalence, and reject empty content / reader-error pages.
//
// Extracted page text is UNTRUSTED SOURCE DATA. It is never executed and is
// only ever placed into a model prompt with explicit "do not follow
// instructions" framing. Provenance (sourceUrl) is assigned by the server from
// the validated input URL — never by the model.

import { JINA_TIMEOUT_MS, MAX_EXTRACT_BYTES, MAX_EXTRACT_TEXT_CHARS } from "@/lib/ai-config";
import { validatePublicWebsiteUrl } from "@/lib/url-validator.server";

export type ExtractedPage = {
  /** Normalized public URL that was read (server-assigned provenance). */
  sourceUrl: string;
  /** Hostname of the source URL. */
  hostname: string;
  /** Apex domain (no www). */
  domain: string;
  /** Truncated, untrusted page text. */
  text: string;
  /** Page title if r.jina.ai returned one. */
  title: string;
};

export type ExtractFailure = {
  ok: false;
  reason: string;
};

export type ExtractSuccess = {
  ok: true;
  page: ExtractedPage;
};

export type ExtractResult = ExtractSuccess | ExtractFailure;

const JINA_ORIGIN = "https://r.jina.ai";

/** Reader-error / placeholder signals that mean no real content was returned. */
function looksLikeErrorPage(text: string, title: string): boolean {
  const t = (text + " " + title).toLowerCase();
  if (t.includes("failed to fetch") || t.includes("could not fetch")) return true;
  if (t.includes("r.jina.ai") && t.includes("error")) return true;
  if (t.includes("no content") && t.length < 200) return true;
  return false;
}

/**
 * Extract page text for a visitor-supplied website URL via r.jina.ai.
 * Returns ok:false (with a non-sensitive reason) on any failure so callers can
 * fall back to the description path. Never throws.
 */
export async function extractPageText(rawWebsite: string): Promise<ExtractResult> {
  const valResult = validatePublicWebsiteUrl(rawWebsite);
  if (!valResult.ok) {
    return { ok: false, reason: valResult.reason };
  }

  // Re-normalize: strip query and fragment, keep path. r.jina.ai expects the
  // full URL as a path suffix.
  let cleanUrl: string;
  try {
    const u = new URL(valResult.url);
    cleanUrl = `${u.protocol}//${u.hostname}${u.pathname}`;
    // remove trailing slash on root path for cleanliness
    if (cleanUrl.endsWith("/") && cleanUrl.length > "https://x.x/".length) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
  } catch {
    return { ok: false, reason: "Invalid URL format" };
  }

  const target = `${JINA_ORIGIN}/${cleanUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "x-retain-images": "none",
      },
    });

    if (!res.ok) {
      return { ok: false, reason: "Reader returned an error" };
    }

    // Cap bytes read from the stream.
    const reader = res.body?.getReader();
    if (!reader) {
      // Fallback: read as text (still bounded by MAX_EXTRACT_BYTES).
      const raw = await res.text();
      return parseJinaResponse(raw, cleanUrl, valResult.normalizedHost, valResult.normalizedDomain);
    }

    const decoder = new TextDecoder();
    let raw = "";
    let bytes = 0;
    let done = false;
    while (!done) {
      const { value, done: rDone } = await reader.read();
      done = rDone;
      if (value) {
        bytes += value.byteLength;
        if (bytes > MAX_EXTRACT_BYTES) {
          try {
            reader.cancel();
          } catch {
            /* ignore */
          }
          break;
        }
        raw += decoder.decode(value, { stream: !done });
      }
    }
    raw += decoder.decode();

    return parseJinaResponse(raw, cleanUrl, valResult.normalizedHost, valResult.normalizedDomain);
  } catch {
    return { ok: false, reason: "Reader request failed or timed out" };
  } finally {
    clearTimeout(timer);
  }
}

function parseJinaResponse(
  raw: string,
  cleanUrl: string,
  normalizedHost: string,
  normalizedDomain: string,
): ExtractResult {
  let data: {
    content?: unknown;
    text?: unknown;
    title?: unknown;
    data?: { url?: unknown };
  } | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // r.jina.ai with Accept: application/json returns JSON; if not, treat as failure.
    return { ok: false, reason: "Reader returned non-JSON" };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, reason: "Reader returned an empty response" };
  }

  // r.jina.ai JSON shape: { content | data: { content }, title, data: { url } }
  const contentRaw = data.content ?? data.text;
  const content =
    typeof contentRaw === "string"
      ? contentRaw
      : typeof (data as { data?: { content?: unknown } }).data?.content === "string"
        ? (data as { data: { content: string } }).data.content
        : "";

  const title = typeof data.title === "string" ? data.title : "";
  const reportedUrl = String((data as { data?: { url?: unknown } }).data?.url ?? "").trim();

  // Require data.url to match the input hostname with only www <-> apex equivalence.
  let reportedHost = "";
  try {
    const u = new URL(reportedUrl.startsWith("http") ? reportedUrl : "https://" + reportedUrl);
    reportedHost = u.hostname.toLowerCase();
  } catch {
    /* leave empty */
  }

  const hostMatches =
    reportedHost === normalizedHost ||
    reportedHost === normalizedDomain ||
    reportedHost === "www." + normalizedDomain ||
    (normalizedHost === "www." + normalizedDomain && reportedHost === normalizedDomain);

  if (!hostMatches) {
    return { ok: false, reason: "Reader returned a different host" };
  }

  const text = content.trim();
  if (text.length < 60) {
    return { ok: false, reason: "Reader returned no usable content" };
  }

  if (looksLikeErrorPage(text, title)) {
    return { ok: false, reason: "Reader returned an error page" };
  }

  const page: ExtractedPage = {
    sourceUrl: cleanUrl,
    hostname: normalizedHost,
    domain: normalizedDomain,
    text: text.slice(0, MAX_EXTRACT_TEXT_CHARS),
    title: title.slice(0, 200),
  };

  return { ok: true, page };
}
