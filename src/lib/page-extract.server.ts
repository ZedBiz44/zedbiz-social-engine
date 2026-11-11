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
  /**
   * Why the read failed:
   * - "backend-unavailable": the server-function transport / outbound reader
   *   call itself could not complete (network error, redirect rejected,
   *   timeout). Distinct from a specific website problem.
   * - "website-unreadable": the request succeeded but the page had no usable
   *   content, or the returned host did not match the requested host.
   * - "invalid-url": the submitted URL failed validation.
   */
  kind: "backend-unavailable" | "website-unreadable" | "invalid-url";
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
    return { ok: false, reason: valResult.reason, kind: "invalid-url" as const };
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
    return { ok: false, reason: "Invalid URL format", kind: "invalid-url" as const };
  }

  const target = `${JINA_ORIGIN}/${cleanUrl}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const res = await fetch(target, {
      method: "GET",
      // "error" keeps the boundary fixed: any HTTP redirect on our side
      // aborts the call. r.jina.ai follows the target URL itself; we do not
      // follow intermediate redirects of the reader endpoint. If the
      // reader times out or is unreachable, the caller falls back to the
      // business-description path (OpenRouter generation works independently).
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "x-retain-images": "none",
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: "Reader returned an error",
        kind: "backend-unavailable" as const,
      };
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
    // The outbound reader call could not complete (network error, redirect
    // rejected, or timeout). r.jina.ai is an external dependency; when it is
    // unreachable the caller falls back to the business-description path
    // (OpenRouter generation works independently of the reader). We still
    // surface this as a website-read failure (needsDescription) rather than a
    // backend-unavailable state, because the app's own server function is
    // fine — only the external reader is down.
    return {
      ok: false,
      reason: "Reader request failed or timed out",
      kind: "website-unreadable" as const,
    };
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
  // r.jina.ai (Accept: application/json) returns:
  //   { code, status, data: { title, description, url, content, ... }, meta }
  // Older/alt shapes may put content/text/title at the top level. Handle both.
  let data: {
    content?: unknown;
    text?: unknown;
    title?: unknown;
    data?: { url?: unknown; content?: unknown; title?: unknown; text?: unknown };
  } | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Reader returned non-JSON", kind: "backend-unavailable" as const };
  }

  if (!data || typeof data !== "object") {
    return {
      ok: false,
      reason: "Reader returned an empty response",
      kind: "backend-unavailable" as const,
    };
  }

  // Content may live at the top level (data.content / data.text) or nested
  // under data.data.content (the current r.jina.ai JSON shape).
  const contentRaw = data.content ?? data.text ?? data.data?.content ?? data.data?.text;
  const content = typeof contentRaw === "string" ? contentRaw : "";

  // Title may live at the top level or nested under data.data.title.
  const titleRaw = data.title ?? data.data?.title;
  const title = typeof titleRaw === "string" ? titleRaw : "";
  const reportedUrl = String(data.data?.url ?? "").trim();

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
    return {
      ok: false,
      reason: "Reader returned a different host",
      kind: "website-unreadable" as const,
    };
  }

  const text = content.trim();
  if (text.length < 60) {
    return {
      ok: false,
      reason: "Reader returned no usable content",
      kind: "website-unreadable" as const,
    };
  }

  if (looksLikeErrorPage(text, title)) {
    return {
      ok: false,
      reason: "Reader returned an error page",
      kind: "website-unreadable" as const,
    };
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
