// Server-only research orchestration using OpenRouter's openrouter:web_fetch.
//
// Reuses the same hardened OpenRouter call path: structured JSON, shape +
// content validation, no logging of authorization or raw provider errors.
// Enforces URL security boundaries (valid HTTP/HTTPS, no credentials, no IP
// literals, no nonstandard ports, strict host allowlist) with NO app-side fetch
// or DNS.
//
// Never imported from client code (filename is *.server.ts).

import { CACHE_TTL_MS, OPENROUTER_KEY_ENV, THROTTLE_MS } from "@/lib/ai-config";
import { generateIdeas, generateTopics, generateTopicsFromPageText } from "@/lib/openrouter.server";
import { extractPageText } from "@/lib/page-extract.server";
import { GENERIC_TOPICS, buildGenericIdeas, normaliseWebsite } from "@/lib/sample-data";
import type { IdeasResult, ResearchSource, TopicsResult } from "@/lib/research-types";

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
// Orchestration
// ---------------------------------------------------------------------------

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

  // 1. Independently-verified page extraction via r.jina.ai (fixed origin,
  //    no app-side fetch of the visitor URL). On success, generate topics from
  //    the extracted page text using the proven plain text-generation route.
  const extract = await extractPageText(input.website);
  if (extract.ok) {
    if (!checkThrottle(k)) {
      return {
        source: "fallback",
        needsDescription: true,
        topics: [],
        note: "Too many requests — please wait a few seconds and try again.",
      };
    }

    const liveOutput = await generateTopicsFromPageText(
      apiKey,
      input.businessName,
      extract.page.text,
      extract.page.sourceUrl,
    );

    if (liveOutput) {
      const result: TopicsResult = {
        source: "live",
        topics: liveOutput.topics,
        businessSummary: liveOutput.businessSummary,
        sourceUrl: liveOutput.sourceUrl,
      };
      topicCache.set(k, { at: Date.now(), result });
      return result;
    }
  }

  // 2. Extraction or generation failed, or URL invalid:
  //    If visitor already provided a description, generate from description.
  //    Otherwise request a one-sentence description. We do NOT return generic
  //    sample topics as clickable cards on a failed live lookup — the visitor
  //    must use their description or enter their own topic.
  if (description.length >= 8) {
    if (!checkThrottle(k)) {
      return {
        source: "fallback",
        needsDescription: true,
        topics: [],
        note: "Too many requests — please wait a few seconds and try again.",
      };
    }

    const topics = await generateTopics(
      apiKey,
      input.businessName,
      description,
      "Business description",
    );

    if (topics) {
      const result: TopicsResult = {
        source: "description",
        topics,
      };
      topicCache.set(k, { at: Date.now(), result });
      return result;
    }
  }

  // 3. Request the existing one-sentence description fallback. We never expose
  //    generic sample topics as clickable cards on a failed live lookup.
  return {
    source: "fallback",
    needsDescription: true,
    topics: [],
    note: extract.ok
      ? "We couldn't read that website. Add a one-sentence business description and we'll suggest topics from that instead."
      : extract.reason,
  };
}

export async function researchIdeasServer(input: {
  businessName: string;
  website: string;
  topic: string;
  isCustom: boolean;
  description?: string | undefined;
  businessSummary?: string | undefined;
  source?: ResearchSource | undefined;
}): Promise<IdeasResult> {
  const norm = normaliseWebsite(input.website);
  const description = input.description?.trim() ?? "";
  const summary = input.businessSummary?.trim() ?? "";
  const k = key(["ideas", norm, input.businessName, input.topic, description, summary]);

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description || summary, input.topic),
      setup: true,
      note: SETUP_NOTE_IDEAS,
    };
  }

  // Pass validated business summary for website-grounded flow; preserve source provenance
  let context = "";
  let contextLabel = "Business context";
  let targetSource: ResearchSource = input.source ?? "description";

  if (summary.length >= 15) {
    context = summary;
    contextLabel = "Verified website summary";
    targetSource = "live";
  } else if (description.length >= 8) {
    context = description;
    contextLabel = "Business description";
    targetSource = "description";
  } else {
    context = input.businessName;
    contextLabel = "Business name only";
  }

  if (!checkThrottle(k)) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description || summary, input.topic),
      note: "Too many requests — please wait a few seconds and try again.",
    };
  }

  const ideas = await generateIdeas(apiKey, input.businessName, input.topic, context, contextLabel);
  if (!ideas) {
    return {
      source: "fallback",
      ideas: buildGenericIdeas(description || summary, input.topic),
      note: "We couldn't draft ideas right now. Showing sample-style ideas below — or go back and try another topic.",
    };
  }

  return { source: targetSource, ideas };
}
