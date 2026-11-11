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
  constantTimeEqualHashes,
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
  | { ok: true; ideas: PostIdea[]; selectedIdeaIndex: number }
  | {
      ok: false;
      reason: "not_found" | "expired" | "email_mismatch" | "already_claimed";
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
 * Atomically claim a pending row using the one-time token + the signed-in
 * user's confirmed email. Verifies the caller's email matches the row's
 * email_key before claiming. Idempotent and expiring: a row already claimed
 * or past its expiry is not claimable.
 */
export async function claimPendingIdeas(args: {
  claimToken: string;
  confirmedEmail: string;
  userId: string;
}): Promise<ClaimOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = hashClaimToken(args.claimToken);
  const emailKey = normalizeEmailKey(args.confirmedEmail);

  // Look up unclaimed, unexpired candidate rows by token hash.
  const { data, error } = await supabaseAdmin
    .from("pending_idea_claims")
    .select("id, email_key, ideas, selected_idea_index, expires_at, claimed_at")
    .eq("claim_token_hash", tokenHash)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (error || !data || data.length === 0) {
    // Either no row for that hash, or it was already claimed / expired.
    return { ok: false, reason: "not_found" };
  }

  const row = data[0];
  if (!row || !constantTimeEqualHashes(hashClaimToken(args.claimToken), tokenHash)) {
    return { ok: false, reason: "not_found" };
  }

  // Verify the signed-in user's confirmed email matches the row's email_key.
  if (row.email_key !== emailKey) {
    return { ok: false, reason: "email_mismatch" };
  }

  // Atomic UPDATE ... RETURNING via the SECURITY DEFINER function. Passes the
  // verified userId so the function never resolves a different account.
  const { data: claimed, error: claimErr } = await supabaseAdmin.rpc("claim_pending_ideas", {
    _claim_token_hash: tokenHash,
    _email_key: emailKey,
    _user_id: args.userId,
  });

  if (claimErr) return { ok: false, reason: "not_found" };
  const resultRows = claimed as
    { id: string; ideas: PostIdea[]; selected_idea_index: number }[] | null;
  if (!resultRows || resultRows.length === 0) {
    // Row was claimed concurrently between our read and the UPDATE.
    return { ok: false, reason: "already_claimed" };
  }

  const claimed0 = resultRows[0]!;
  return {
    ok: true,
    ideas: claimed0.ideas,
    selectedIdeaIndex: claimed0.selected_idea_index,
  };
}
