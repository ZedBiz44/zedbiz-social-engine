// Public, client-safe types for the save / claim / draft flow.
//
// These describe ONLY public fields — never raw errors, secrets, claim-token
// hashes, or internal pending records. Pending records are never exposed to
// the browser; only a short opaque one-time claim token (itself never
// persisted in the browser) is returned to the visitor.

import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

/** Result of creating a pending claim (pre-sign-in). */
export type PendingCreated = {
  ok: true;
  /** Opaque one-time claim token (used to claim after sign-in). */
  claimToken: string;
  /** Masked email, e.g. "j***@example.com" — never the full address. */
  emailMasked: string;
  /** Seconds before the pending record expires. */
  expiresInSeconds: number;
};

export type PendingCreateError = {
  ok: false;
  reason: "invalid_email" | "rate_limited" | "insert_failed";
};

export type PendingCreateResult = PendingCreated | PendingCreateError;

/** Result of claiming a pending record after sign-in. */
export type ClaimResult =
  | {
      ok: true;
      /** The id of the saved_idea_sets row the atomic RPC inserted. */
      savedSetId: string;
      ideas: PostIdea[];
      selectedIdeaIndex: number;
    }
  | {
      ok: false;
      reason: "not_found" | "expired" | "email_mismatch" | "already_claimed" | "save_failed";
    };

/** A saved set of three ideas owned by a signed-in user. */
export type SavedIdeaSet = {
  id: string;
  createdAt: string;
  businessName: string;
  website: string;
  topic: string;
  isCustomTopic: boolean;
  description: string;
  ideas: PostIdea[];
  selectedIdeaIndex: number;
};

/** A draft built from one selected idea: editable caption + visual brief. */
export type Draft = {
  id: string;
  savedSetId: string;
  updatedAt: string;
  revision: number;
  platform: "facebook" | "instagram";
  caption: string;
  visualBrief: string;
  approved: boolean;
};

/** Public work list returned to a signed-in owner. */
export type OwnerWork = {
  savedSets: SavedIdeaSet[];
  drafts: Draft[];
};

/** Result of generating a draft from a selected idea. */
export type DraftGenResult =
  { ok: true; draft: Draft } | { ok: false; reason: "setup" | "generation_failed"; note?: string };

export type { PostIdea, TopicSuggestion };
