// Thin server-function wrappers (client-safe to import). All real logic lives
// in claim.server.ts and owner.server.ts so this file stays a pure RPC
// boundary. The claim + save + draft + load operations are auth-protected;
// the pre-auth pending creation is public (rate-limited server-side).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OPENROUTER_KEY_ENV } from "@/lib/ai-config";
import {
  claimPendingIdeas as claimPendingIdeasServer,
  createPendingClaim as createPendingClaimServer,
} from "@/lib/claim.server";
import {
  CURRENT_AI_MODEL,
  deleteSavedSet as deleteSavedSetServer,
  editDraft as editDraftServer,
  generateDraftForIdea as generateDraftForIdeaServer,
  loadOwnerWork as loadOwnerWorkServer,
  saveIdeaSet as saveIdeaSetServer,
  setDraftApproval as setDraftApprovalServer,
} from "@/lib/owner.server";
import type {
  ClaimResult,
  DraftGenResult,
  OwnerWork,
  PendingCreateResult,
  SavedIdeaSet,
} from "@/lib/save-types";

const ideaSchema = z.object({
  hook: z.string().min(1).max(300),
  angle: z.string().min(1).max(400),
  takeaway: z.string().min(1).max(400),
});

// ---------------------------------------------------------------------------
// Pre-auth: create a short-lived pending claim (public, rate-limited).
// ---------------------------------------------------------------------------

const createPendingSchema = z.object({
  email: z.string().min(3).max(320),
  businessName: z.string().min(1).max(120),
  website: z.string().min(1).max(300),
  topic: z.string().min(1).max(200),
  isCustomTopic: z.boolean(),
  description: z.string().max(400),
  ideas: z.array(ideaSchema).length(3),
  selectedIdeaIndex: z.number().int().min(0).max(2),
});

export const createPendingClaim = createServerFn({ method: "POST" })
  .validator((data) => createPendingSchema.parse(data))
  .handler(async ({ data }): Promise<PendingCreateResult> => {
    try {
      const created = await createPendingClaimServer({
        email: data.email,
        businessName: data.businessName,
        website: data.website,
        topic: data.topic,
        isCustomTopic: data.isCustomTopic,
        description: data.description,
        ideas: data.ideas,
        selectedIdeaIndex: data.selectedIdeaIndex,
      });
      return { ok: true, ...created };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "rate_limited") return { ok: false, reason: "rate_limited" };
      if (msg === "invalid_email") return { ok: false, reason: "invalid_email" };
      return { ok: false, reason: "insert_failed" };
    }
  });

// ---------------------------------------------------------------------------
// Post-sign-in: claim the pending record (auth-protected).
// The verified email + userId come from the JWT claims, not the browser.
// ---------------------------------------------------------------------------

const claimSchema = z.object({ claimToken: z.string().min(8).max(64) });

export const claimPendingIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => claimSchema.parse(data))
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    const email = (context.claims as { email?: string }).email;
    if (!email) return { ok: false, reason: "email_mismatch" };
    return claimPendingIdeasServer({
      claimToken: data.claimToken,
      confirmedEmail: email,
      userId: context.userId,
    });
  });

// ---------------------------------------------------------------------------
// Owner save: persist the exact three ideas + selected idea (auth-protected).
// ---------------------------------------------------------------------------

const saveIdeaSetSchema = z.object({
  businessName: z.string().min(1).max(120),
  website: z.string().min(1).max(300),
  topic: z.string().min(1).max(200),
  isCustomTopic: z.boolean(),
  description: z.string().max(400),
  ideas: z.array(ideaSchema).length(3),
  selectedIdeaIndex: z.number().int().min(0).max(2),
});

export const saveIdeaSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => saveIdeaSetSchema.parse(data))
  .handler(async ({ data, context }): Promise<SavedIdeaSet> => {
    return saveIdeaSetServer(context, {
      businessName: data.businessName,
      website: data.website,
      topic: data.topic,
      isCustomTopic: data.isCustomTopic,
      description: data.description,
      ideas: data.ideas,
      selectedIdeaIndex: data.selectedIdeaIndex,
    });
  });

// ---------------------------------------------------------------------------
// Generate a draft (caption + visual brief) from the selected idea
// (auth-protected). Uses the existing server-side OpenRouter model.
// ---------------------------------------------------------------------------

const generateDraftSchema = z.object({
  savedSetId: z.string().uuid(),
  platform: z.enum(["facebook", "instagram"]),
  idea: ideaSchema,
  businessName: z.string().min(1).max(120),
});

export const generateDraftForIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => generateDraftSchema.parse(data))
  .handler(async ({ data, context }): Promise<DraftGenResult> => {
    const draft = await generateDraftForIdeaServer(context, {
      savedSetId: data.savedSetId,
      platform: data.platform,
      idea: data.idea,
      businessName: data.businessName,
    });
    if (!draft) {
      const hasKey = Boolean(process.env[OPENROUTER_KEY_ENV]);
      return hasKey
        ? {
            ok: false,
            reason: "generation_failed",
            note: "We couldn't draft that just now. Try again in a moment.",
          }
        : { ok: false, reason: "setup", note: "Live drafting isn't connected yet." };
    }
    return { ok: true, draft };
  });

// ---------------------------------------------------------------------------
// Edit a draft's caption / visual brief (auth-protected). Editing approved
// text clears approval and bumps the revision.
// ---------------------------------------------------------------------------

const editDraftSchema = z.object({
  draftId: z.string().uuid(),
  caption: z.string().min(1).max(2000).optional(),
  visualBrief: z.string().min(1).max(800).optional(),
});

export const editDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => editDraftSchema.parse(data))
  .handler(async ({ data, context }) => {
    const args: { draftId: string; caption?: string; visualBrief?: string } = {
      draftId: data.draftId,
    };
    if (data.caption !== undefined) args.caption = data.caption;
    if (data.visualBrief !== undefined) args.visualBrief = data.visualBrief;
    return editDraftServer(context, args);
  });

// ---------------------------------------------------------------------------
// Toggle approval on the current revision (auth-protected).
// ---------------------------------------------------------------------------

const approvalSchema = z.object({
  draftId: z.string().uuid(),
  approved: z.boolean(),
});

export const setDraftApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => approvalSchema.parse(data))
  .handler(async ({ data, context }) => {
    return setDraftApprovalServer(context, {
      draftId: data.draftId,
      approved: data.approved,
    });
  });

// ---------------------------------------------------------------------------
// Load only the current user's saved sets + drafts (auth-protected).
// ---------------------------------------------------------------------------

export const loadOwnerWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerWork> => {
    return loadOwnerWorkServer(context);
  });

// ---------------------------------------------------------------------------
// Delete a saved set (auth-protected; cascades to its drafts).
// ---------------------------------------------------------------------------

const deleteSchema = z.object({ savedSetId: z.string().uuid() });

export const deleteSavedSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await deleteSavedSetServer(context, data.savedSetId);
    return { ok: true as const };
  });

// Exposed so the UI can show which model is wired (publishable slug).
export const AI_MODEL_SLUG = CURRENT_AI_MODEL;
