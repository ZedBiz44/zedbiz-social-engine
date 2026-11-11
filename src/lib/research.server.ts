// Server-only research orchestration.
//
// WEBSITE FETCHING IS INTENTIONALLY DISABLED.
//
// The previous implementation validated the URL/host and blocked private
// ranges, then called the runtime `fetch()` with `redirect: "manual"`. That
// is necessary but NOT sufficient: the runtime resolver still performs its
// own DNS lookup and connects to whatever address it returns. On this
// edge/Worker runtime there is no raw-socket or custom-DNS API available to
// app code, so we cannot PIN the validated hostname to a specific resolved
// address (the standard DNS-rebinding defence), nor assert an explicit
// public-only egress guarantee from app code. A TOCTOU gap between our host
// check and the runtime's connect would let a rebinding response reach an
// internal address.
//
// Per the task: if we cannot pin the validated address or use a vetted
// network layer with an explicit public-only guarantee, DISABLE website
// fetching and use the description path until a safe fetch is available.
// `safeFetchWebsite` therefore always returns a "disabled" result; the
// orchestration falls back to the visitor's one-sentence description.
//
// Never imported from client code (filename is *.server.ts).

import { CACHE_TTL_MS, OPENROUTER_KEY_ENV, THROTTLE_MS } from "@/lib/ai-config";
import { generateIdeas, generateTopics } from "@/lib/openrouter.server";
import { GENERIC_TOPICS, buildGenericIdeas, normaliseWebsite } from "@/lib/sample-data";
import type { IdeasResult, TopicsResult } from "@/lib/research-types";

// ---------------------------------------------------------------------------
// Website fetch — DISABLED (see file header). Kept as a stable boundary so
// the rest of the code never special-cases "no fetch available".
// ---------------------------------------------------------------------------

export type FetchResult =
  { ok: true; text: string; sourceUrl: string; finalUrl: string } | { ok: false; reason: string };

/**
 * Always returns a disabled result. Website fetching is turned off because
 * the runtime offers no way to pin the validated address or enforce a
 * public-only egress from app code. Callers fall back to the description.
 */
export async function safeFetchWebsite(_input: string): Promise<FetchResult> {
  return { ok: false, reason: "website fetch disabled (address pinning unavailable)" };
}

// ---------------------------------------------------------------------------
// Throttling + de-dup (in-memory, per worker instance; editor-only testing)
// ---------------------------------------------------------------------------

const topicCache = new Map<string, { at: number; result: TopicsResult }>();
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

// ---------------------------------------------------------------------------
// Orchestration (called by the thin server-function wrappers)
// ---------------------------------------------------------------------------

/**
 * Plain-language note shown to the visitor when live generation is
 * unavailable. NEVER mentions credentials, secret names, or setup steps —
 * those belong in the builder response, not the visitor UI.
 */
const SETUP_NOTE =
  "Live research isn't connected yet, so we're showing sample-style topics. You can still enter your own topic below.";
const SETUP_NOTE_IDEAS =
  "Live research isn't connected yet, so we're showing sample-style ideas below.";

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
      note: SETUP_NOTE,
    };
    topicCache.set(k, { at: Date.now(), result });
    return result;
  }

  // Website fetching is disabled (see file header). We require a description.
  if (description.length < 8) {
    return {
      source: "fallback",
      needsDescription: true,
      topics: [],
      note: "We can't read your website yet. Add a one-sentence business description and we'll suggest topics from that instead.",
    };
  }

  if (!checkThrottle(k)) {
    return {
      source: "fallback",
      topics: GENERIC_TOPICS,
      note: "Too many requests — please wait a few seconds and try again.",
    };
  }

  const topics = await generateTopics(
    apiKey,
    input.businessName,
    description,
    "Business description",
  );
  if (!topics) {
    return {
      source: "fallback",
      topics: GENERIC_TOPICS,
      note: "We couldn't generate topics right now. Showing sample-style topics — or enter your own topic below.",
    };
  }

  const result: TopicsResult = {
    source: "description",
    topics,
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
      note: SETUP_NOTE_IDEAS,
    };
  }

  // Website fetching is disabled. Context = description, else business name.
  let context = "";
  let contextLabel = "Business description";
  if (description.length >= 8) {
    context = description;
  } else {
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
      note: "We couldn't draft ideas right now. Showing sample-style ideas below — or go back and try another topic.",
    };
  }

  return { source: description.length >= 8 ? "description" : "live", ideas };
}
