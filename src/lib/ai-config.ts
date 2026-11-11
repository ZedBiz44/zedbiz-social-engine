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

// --- Website fetch bounds ---
export const FETCH_TIMEOUT_MS = 30000;
export const WEB_FETCH_MAX_CONTENT_TOKENS = 1800;
export const WEB_FETCH_MAX_USES = 1;
export const WEB_FETCH_ENGINE = "openrouter";
export const WEBSITE_TEXT_CHARS = 6000;
