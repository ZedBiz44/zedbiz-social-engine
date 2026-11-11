// Server-only crypto helpers for pending claim tokens.
//
// Tokens are cryptographically random one-time strings. We store only their
// SHA-256 hash (never the raw token) and compare hashes on claim. The raw
// token is returned to the visitor once and never persisted in the browser
// session either — it's only used to drive the in-app claim-after-sign-in
// step.
//
// Never imported from client code (filename is *.server.ts).

import { createHash, randomBytes } from "node:crypto";

/** Bytes of entropy in a claim token (192 bits). */
const TOKEN_BYTES = 24;
/** TTL for a pending record (10 minutes). */
export const PENDING_TTL_SECONDS = 10 * 60;
/** Max pending records per normalized email inside the rolling rate-limit
 *  window (editor-only testing). */
export const PENDING_RATE_LIMIT = 3;
export const PENDING_RATE_WINDOW_SECONDS = 60 * 10;

/** Returns a base64url one-time claim token (no padding). */
export function newClaimToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 hash of a claim token, hex-encoded, for storage. */
export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare of two equal-length hex hash strings. */
export function constantTimeEqualHashes(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  // timingSafeEqual over the raw bytes.
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    const x = ab[i] ?? 0;
    const y = bb[i] ?? 0;
    diff |= x ^ y;
  }
  return diff === 0;
}

/** Mask an email for display, e.g. "j***@example.com". Never the full address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "•••@•••";
  const head = name.slice(0, 1);
  const dom = domain.split(".");
  const tld = dom[dom.length - 1] ?? "•••";
  const rest = dom.slice(0, -1).join(".");
  return `${head}***@${rest || "•••"}.${tld}`;
}
