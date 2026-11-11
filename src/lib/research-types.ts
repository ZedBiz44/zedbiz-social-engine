// Public, client-safe result types shared between the UI and the server
// functions. These describe ONLY public fields — never raw errors, secrets,
// or provider payloads.

import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

/**
 * How a result was produced:
 * - "sample":      labelled sample data for the demo businesses
 * - "description": generated from the visitor's one-sentence description
 *                  (a real model request succeeded, grounded in their text)
 * - "live":        generated from fetched website text using OpenRouter managed
 *                  web_fetch tool (a real model request succeeded, grounded in
 *                  page content).
 * - "fallback":    generic templated suggestions shown when live generation
 *                  is unavailable (no key, throttle, or generation failed)
 */
export type ResearchSource = "sample" | "description" | "live" | "fallback";

export type TopicsResult = {
  source: ResearchSource;
  topics: TopicSuggestion[];
  /** Short factual business summary extracted from web_fetch page content. */
  businessSummary?: string;
  /** Validated target URL that was fetched. */
  sourceUrl?: string;
  /** When the site could not be read and we need a one-sentence description. */
  needsDescription?: boolean;
  /** When the OpenRouter key is not configured. */
  setup?: boolean;
  /** Human-readable note (setup message, fallback reason, throttle). Never raw errors. */
  note?: string;
};

export type IdeasResult = {
  source: ResearchSource;
  ideas: PostIdea[];
  setup?: boolean;
  note?: string;
};

export type { PostIdea, TopicSuggestion };
