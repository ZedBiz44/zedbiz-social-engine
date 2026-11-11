// Public, client-safe result types shared between the UI and the server
// functions. These describe ONLY public fields — never raw errors, secrets,
// or provider payloads.

import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

export type ResearchSource = "sample" | "live" | "fallback";

export type TopicsResult = {
  source: ResearchSource;
  topics: TopicSuggestion[];
  /** Public URL the research was grounded in, when the site was read. */
  sourceUrl?: string;
  /** When the site could not be read and we need a one-sentence description. */
  needsDescription?: boolean;
  /** When the OpenRouter key is not configured (setup message). */
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
