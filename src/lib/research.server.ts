// Server-only research orchestration: safe website fetch, SSRF validation,
// throttling/de-dup, and the glue between fetched text and OpenRouter.
// Never imported from client code (filename is *.server.ts).

import {
  CACHE_TTL_MS,
  FETCH_MAX_BYTES,
  FETCH_MAX_REDIRECTS,
  FETCH_TIMEOUT_MS,
  OPENROUTER_KEY_ENV,
  THROTTLE_MS,
  WEBSITE_TEXT_CHARS,
} from "@/lib/ai-config";
import { generateIdeas, generateTopics } from "@/lib/openrouter.server";
import { GENERIC_TOPICS, buildGenericIdeas, normaliseWebsite } from "@/lib/sample-data";
import type { IdeasResult, TopicsResult } from "@/lib/research-types";

// ---------------------------------------------------------------------------
// SSRF-safe website fetch
// ---------------------------------------------------------------------------

export type FetchResult =
  { ok: true; text: string; sourceUrl: string; finalUrl: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);
const BLOCKED_TLDS = [
  ".local",
  ".internal",
  ".localhost",
  ".test",
  ".example",
  ".invalid",
  ".box",
  ".onion",
  ".arpa",
];

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  const h = host.replace(/^\[|\]$/g, "");
  if (h.includes(":") && /^[0-9a-fA-F:.]+$/.test(h)) return true; // IPv6
  return false;
}

function isPrivateIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (h.includes(":")) {
    const low = h.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("::ffff:")) {
      const v4part = low.split(":").pop() ?? "";
      return isPrivateIpLiteral(v4part);
    }
    return false;
  }
  return false;
}

function validateHost(host: string): string | null {
  if (!host) return "missing host";
  if (isIpLiteral(host)) {
    // Raw IPs are blocked outright (we cannot pin DNS on this runtime, so we
    // refuse IP literals to avoid reaching internal addresses).
    if (isPrivateIpLiteral(host)) return "private/reserved IP not allowed";
    return "raw IP addresses are not allowed";
  }
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return "blocked hostname";
  if (BLOCKED_TLDS.some((tld) => lower.endsWith(tld))) return "blocked TLD";
  if (!lower.includes(".")) return "hostname must be a public domain";
  return null;
}

function validateUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { error: "only http/https allowed" };
  if (url.username || url.password) return { error: "credentials in URL are not allowed" };
  const port = url.port;
  if (
    port &&
    !((url.protocol === "http:" && port === "80") || (url.protocol === "https:" && port === "443"))
  ) {
    return { error: "non-standard ports are not allowed" };
  }
  const hostErr = validateHost(url.hostname);
  if (hostErr) return { error: hostErr };
  return { url };
}

/** Strips markup to plain text. Page text is treated as untrusted data only. */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/"/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bounded, SSRF-hardened fetch of a public website. Follows redirects
 * manually and re-validates every hop, caps time + size, and returns plain
 * text only. Never throws.
 */
export async function safeFetchWebsite(input: string): Promise<FetchResult> {
  let current = input.trim();
  let finalUrl = current;
  for (let hop = 0; hop <= FETCH_MAX_REDIRECTS; hop++) {
    if (!/^https?:\/\//i.test(current)) current = "https://" + current;
    const v = validateUrl(current);
    if ("error" in v) return { ok: false, reason: v.error };
    const url = v.url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "SocialMediaMachine/1.0 (+research)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.5",
        },
      });
    } catch {
      return { ok: false, reason: "fetch failed" };
    } finally {
      clearTimeout(timer);
    }

    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "redirect without location" };
      try {
        current = new URL(loc, url.toString()).toString();
        finalUrl = current;
        continue;
      } catch {
        return { ok: false, reason: "invalid redirect target" };
      }
    }
    if (status !== 200) return { ok: false, reason: `status ${status}` };

    const ct = res.headers.get("content-type") ?? "";
    if (ct !== "" && !/text|html|xml|json/i.test(ct)) {
      return { ok: false, reason: "non-text content" };
    }

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, reason: "no response body" };
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let raw = "";
    let total = 0;
    try {
      while (total < FETCH_MAX_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } catch {
      return { ok: false, reason: "read failed" };
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }

    const text = extractText(raw).slice(0, WEBSITE_TEXT_CHARS);
    if (text.trim().length < 40) return { ok: false, reason: "not enough readable text" };
    return { ok: true, text, sourceUrl: input, finalUrl };
  }
  return { ok: false, reason: "too many redirects" };
}

// ---------------------------------------------------------------------------
// Throttling + de-dup (in-memory, per worker instance; editor-only testing)
// ---------------------------------------------------------------------------

const topicCache = new Map<string, { at: number; result: TopicsResult }>();
const textCache = new Map<string, { at: number; text: string; finalUrl: string }>();
const lastCall = new Map<string, number>();

function key(parts: string[]): string {
  return parts.join("|").toLowerCase();
}

/** Returns false (and records nothing) if a call is too soon; true otherwise. */
function checkThrottle(k: string): boolean {
  const now = Date.now();
  const last = lastCall.get(k) ?? 0;
  if (now - last < THROTTLE_MS) return false;
  lastCall.set(k, now);
  return true;
}

function getCachedText(norm: string): { text: string; finalUrl: string } | null {
  const c = textCache.get(norm);
  if (c && Date.now() - c.at < CACHE_TTL_MS) return { text: c.text, finalUrl: c.finalUrl };
  return null;
}

// ---------------------------------------------------------------------------
// Orchestration (called by the thin server-function wrappers)
// ---------------------------------------------------------------------------

export async function researchTopicsServer(input: {
  businessName: string;
  website: string;
  description?: string | undefined;
}): Promise<TopicsResult> {
  const norm = normaliseWebsite(input.website);
  const description = input.description?.trim() ?? "";
  const k = key(["topics", norm, input.businessName, description]);

  const cached = topicCache.get(k);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) {
    const result: TopicsResult = {
      source: "fallback",
      topics: GENERIC_TOPICS,
      setup: true,
      note: "Live research isn't connected yet. Add your OpenRouter API key in AI Studio Secrets (name: OPENROUTER_API_KEY), then publish to enable it. Showing sample-style topics below so you can preview the full flow.",
    };
    topicCache.set(k, { at: Date.now(), result });
    return result;
  }

  // Resolve context: prefer cached/recently-fetched website text, else fetch.
  let context = "";
  let contextLabel = "Website text";
  let sourceUrl: string | undefined;
  const cachedText = getCachedText(norm);
  if (cachedText) {
    context = cachedText.text;
    sourceUrl = cachedText.finalUrl;
  } else {
    const fr = await safeFetchWebsite(input.website);
    if (fr.ok) {
      context = fr.text;
      sourceUrl = fr.finalUrl;
      textCache.set(norm, { at: Date.now(), text: fr.text, finalUrl: fr.finalUrl });
    }
  }

  if (!context) {
    if (description.length >= 8) {
      context = description;
      contextLabel = "Business description";
    } else {
      // Site unreadable and no description yet — ask for one.
      return {
        source: "fallback",
        needsDescription: true,
        topics: [],
        note: "We couldn't read that site. Add a one-sentence business description and we'll suggest topics from that instead.",
      };
    }
  }

  if (!checkThrottle(k)) {
    return {
      source: "fallback",
      topics: GENERIC_TOPICS,
      note: "Too many requests — please wait a few seconds and try again.",
    };
  }

  const topics = await generateTopics(apiKey, input.businessName, context, contextLabel);
  if (!topics) {
    return {
      source: "fallback",
      topics: GENERIC_TOPICS,
      note: "Live research hit a snag generating topics. Showing sample-style topics so you can keep going — or enter your own topic below.",
    };
  }

  const result: TopicsResult = {
    source: "live",
    topics,
    ...(sourceUrl ? { sourceUrl } : {}),
  };
  topicCache.set(k, { at: Date.now(), result });
  return result;
}

export async function researchIdeasServer(input: {
  businessName: string;
  website: string;
  topic: string;
  isCustom: boolean;
  description?: string | undefined;
}): Promise<IdeasResult> {
  const norm = normaliseWebsite(input.website);
  const description = input.description?.trim() ?? "";
  const k = key(["ideas", norm, input.businessName, input.topic, description]);

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description, input.topic),
      setup: true,
      note: "Live research isn't connected yet. Add OPENROUTER_API_KEY in AI Studio Secrets to generate real ideas. Showing sample-style ideas below so you can preview the flow.",
    };
  }

  // Resolve context: cached text > fresh fetch > description > business name.
  let context = "";
  let contextLabel = "Website text";
  const cachedText = getCachedText(norm);
  if (cachedText) {
    context = cachedText.text;
  } else {
    const fr = await safeFetchWebsite(input.website);
    if (fr.ok) {
      context = fr.text;
      textCache.set(norm, { at: Date.now(), text: fr.text, finalUrl: fr.finalUrl });
    }
  }
  if (!context && description.length >= 8) {
    context = description;
    contextLabel = "Business description";
  }
  if (!context) {
    context = input.businessName;
    contextLabel = "Business name only";
  }

  if (!checkThrottle(k)) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description, input.topic),
      note: "Too many requests — please wait a few seconds and try again.",
    };
  }

  const ideas = await generateIdeas(apiKey, input.businessName, input.topic, context, contextLabel);
  if (!ideas) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description, input.topic),
      note: "Live research hit a snag drafting ideas. Showing sample-style ideas so you can keep going.",
    };
  }

  return { source: "live", ideas };
}
