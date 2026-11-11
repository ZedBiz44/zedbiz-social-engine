// Public, client-safe types for the save / claim / draft flow.
//
// These describe ONLY public fields — never raw errors, secrets, claim-token
// hashes, or internal pending records. Pending records are never exposed to
// the browser; only a short opaque claim token (itself never persisted in the
// browser either) is returned to the visitor.

import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

/** A saved set of three ideas owned by a signed-in user. */
export type SavedIdeaSet = {
  id: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  businessName: string;
  website: string;
  topic: string;
  isCustomTopic: boolean;
  description: string;
  /** The exact three ideas preserved at save time. */
  ideas: PostIdea[];
  /** Index (0..2) of the idea the owner selected to draft. */
  selectedIdeaIndex: number;
};

/** A draft built from one selected idea: an editable caption + visual brief. */
export type Draft = {
  id: string;
  savedSetId: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Monotonic revision counter; approval applies to the current revision. */
  revision: number;
  platform: "facebook" | "instagram";
  /** Editable caption text. */
  caption: string;
  /** Separate visual brief (image direction), editable. */
  visualBrief: string;
  /** True when the owner approved the CURRENT revision. Editing clears it. */
  approved: boolean;
};

/** What the visitor sees after creating a pending record. No internal id. */
export type PendingCreated = {
  /** Opaque one-time claim token (sent to email in production; shown in preview). */
  claimToken: string;
  /** Masked email, e.g. "j***@example.com" — never the full address. */
  emailMasked: string;
  /** Seconds before the pending record expires. */
  expiresInSeconds: number;
};

/** Result of attempting to claim a pending record after sign-in. */
export type ClaimResult =
  | { ok: true; savedSetId: string }
  | { ok: false; reason: "not_found" | "expired" | "email_mismatch" | "already_claimed" };

/** A demo account session (preview only — no real auth backend). */
export type DemoSession = {
  email: string;
  emailConfirmed: boolean;
} | null;

/** Public work list returned to a signed-in owner. */
export type OwnerWork = {
  savedSets: SavedIdeaSet[];
  drafts: Draft[];
};

export type { PostIdea, TopicSuggestion };
