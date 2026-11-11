// Server-only orchestration for the pending-claim flow.
//
// Pre-sign-in: preserve the exact three ideas + selected idea + business
// context in a short-lived `pending_idea_claims` row keyed by the NORMALIZED
// email. The row stores only the HASH of a cryptographically random one-time
// claim token; the raw token is returned to the caller once and never
// persisted in the browser. Rate-limited per normalized email.
//
// Post-sign-in (after email verification): atomically claim the row by token
// hash + confirmed email, returning the preserved ideas. Idempotent (a row
// already claimed is not claimable again) and expiring (rows past expires_at
// are not claimable). Pending records are NEVER exposed to the browser.
//
// Never imported from client code (filename is *.server.ts).

import {
  hashClaimToken,
  maskEmail,
  newClaimToken,
  PENDING_RATE_LIMIT,
  PENDING_RATE_WINDOW_SECONDS,
  PENDING_TTL_SECONDS,
} from "@/lib/claim-crypto.server";
import type { PostIdea } from "@/lib/sample-data";

export type PendingInput = {
  email: string;
  businessName: string;
  website: string;
  topic: string;
  isCustomTopic: boolean;
  description: string;
  ideas: PostIdea[];
  selectedIdeaIndex: number;
};

export type PendingCreated = {
  claimToken: string;
  emailMasked: string;
  expiresInSeconds: number;
};

export type ClaimOutcome =
  | {
      ok: true;
      savedSetId: string;
      ideas: PostIdea[];
      selectedIdeaIndex: number;
    }
  | {
      ok: false;
      reason: "not_found" | "expired" | "email_mismatch" | "already_claimed" | "save_failed";
    };

/** Normalize an email to a stable key (lowercase, trim). */
export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates a short-lived pending claim row tied to the normalized email.
 * Rate-limited per email. Returns the one-time token + masked email; never
 * the row id or any internal field.
 */
export async function createPendingClaim(input: PendingInput): Promise<PendingCreated> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const emailKey = normalizeEmailKey(input.email);
  if (!emailKey || !emailKey.includes("@")) {
    throw new Error("invalid_email");
  }

  // Rate limit: count rows for this email inside the rolling window.
  const since = new Date(Date.now() - PENDING_RATE_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("pending_idea_claims")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("email_key", emailKey);
  if ((count ?? 0) >= PENDING_RATE_LIMIT) {
    throw new Error("rate_limited");
  }

  const token = newClaimToken();
  const tokenHash = hashClaimToken(token);
  const expiresAt = new Date(Date.now() + PENDING_TTL_SECONDS * 1000).toISOString();

  const row = {
    email_key: emailKey,
    claim_token_hash: tokenHash,
    business_name: input.businessName,
    website: input.website,
    topic: input.topic,
    is_custom_topic: input.isCustomTopic,
    description: input.description,
    ideas: input.ideas,
    selected_idea_index: input.selectedIdeaIndex,
    expires_at: expiresAt,
  };

  const { error } = await supabaseAdmin.from("pending_idea_claims").insert(row);
  if (error) throw new Error("insert_failed");

  return {
    claimToken: token,
    emailMasked: maskEmail(emailKey),
    expiresInSeconds: PENDING_TTL_SECONDS,
  };
}

/**
 * Atomically claim a pending row AND insert the saved idea set in a single
 * transactional RPC. The RPC locks the pending row, checks expiry + the
 * verified email, inserts the saved set, and only then marks the claim
 * consumed (storing the saved set id). An insert failure rolls back the
 * claim, so a retry can still succeed. A legitimate same-owner retry of an
 * already-consumed claim returns the existing saved set id (idempotent).
 *
 * Identity (email + userId) comes from the verified JWT claims, not the
 * browser. Pending records are never exposed.
 */
export async function claimPendingIdeas(args: {
  claimToken: string;
  confirmedEmail: string;
  userId: string;
}): Promise<ClaimOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = hashClaimToken(args.claimToken);
  const emailKey = normalizeEmailKey(args.confirmedEmail);

  // Atomic claim + save. Returns { saved_set_id, reason }.
  const { data, error } = await supabaseAdmin.rpc("claim_and_save_ideas", {
    _claim_token_hash: tokenHash,
    _email_key: emailKey,
    _user_id: args.userId,
  });

  if (error || !data) {
    return { ok: false, reason: "save_failed" };
  }

  const rows = data as unknown as { saved_set_id: string | null; reason: string }[] | null;
  if (!rows || rows.length === 0) return { ok: false, reason: "save_failed" };
  const result = rows[0]!;

  if (result.reason !== "ok" || !result.saved_set_id) {
    // Map the RPC reason to the public ClaimResult reason. The RPC never
    // returns "email_mismatch" (a non-matching email yields "not_found"),
    // but keep the mapping for completeness.
    const reason = result.reason as ClaimOutcome extends { ok: false; reason: infer R } ? R : never;
    return { ok: false, reason: (reason as string) === "expired" ? "expired" : "not_found" };
  }

  // The RPC inserted the saved set. Fetch the preserved ideas from the
  // pending row (still readable by service_role) so the client can show
  // them without an extra round-trip to saved_idea_sets.
  const { data: pending } = await supabaseAdmin
    .from("pending_idea_claims")
    .select("ideas, selected_idea_index")
    .eq("claim_token_hash", tokenHash)
    .eq("email_key", emailKey)
    .limit(1);

  const row = pending?.[0] as { ideas: PostIdea[]; selected_idea_index: number } | undefined;
  if (!row) {
    // The saved set exists; we just couldn't read the ideas back. Still a
    // success — the dashboard will load the set from saved_idea_sets.
    return {
      ok: true,
      savedSetId: result.saved_set_id,
      ideas: [],
      selectedIdeaIndex: 0,
    };
  }

  return {
    ok: true,
    savedSetId: result.saved_set_id,
    ideas: row.ideas,
    selectedIdeaIndex: row.selected_idea_index,
  };
}
