// Centralized AI configuration for Social Media Machine.
//
// The model slug lives here so we can swap google/gemini-3.5-flash-lite for
// google/gemini-3.8-flash (or any other) in ONE place when comparing models.
// Nothing here is secret — these are publishable defaults.

/** Default OpenRouter model used for topic + idea generation. */
export const AI_MODEL = "google/gemini-3.5-flash-lite";

/** Candidate model for later comparison — kept here, not yet wired into calls. */
export const AI_MODEL_CANDIDATE = "google/gemini-3.8-flash";

/** OpenRouter chat completions endpoint. */
export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Secret name the owner must set in AI Studio Secrets to enable live research. */
export const OPENROUTER_KEY_ENV = "OPENROUTER_API_KEY";

// --- Output token caps (modest; suitable for editor-only testing) ---
export const MAX_TOKENS_TOPICS = 400;
export const MAX_TOKENS_IDEAS = 900;
/** Output token cap for draft generation (caption + visual brief). */
export const MAX_TOKENS_DRAFT = 1200;

// --- Throttling + dedupe (in-memory, per worker instance) ---
/** Minimum interval between calls for the same key. */
export const THROTTLE_MS = 8000;
/** How long a successful result is cached for de-duplication. */
export const CACHE_TTL_MS = 5 * 60 * 1000;

// --- OpenRouter request timeout (plain text generation) ---
/** Bounded timeout for the OpenRouter topics/ideas request. */
export const FETCH_TIMEOUT_MS = 25000;
export const WEBSITE_TEXT_CHARS = 6000;

// --- Independently-verified page extraction via r.jina.ai ---
/** Fixed reader origin used for page extraction (never the visitor URL). */
export const JINA_ORIGIN = "https://r.jina.ai";
/** Bounded timeout for the r.jina.ai reader request. */
export const JINA_TIMEOUT_MS = 18000;
/** Max bytes read from the reader response stream. */
export const MAX_EXTRACT_BYTES = 200_000;
/** Max characters of extracted page text passed to the model. */
export const MAX_EXTRACT_TEXT_CHARS = 6000;
