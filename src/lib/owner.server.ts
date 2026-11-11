// Server-only owner operations: saving the exact three ideas + selected idea,
// generating a draft from the selected idea (caption + visual brief), and
// editing / approving drafts. All write paths require a signed-in owner and
// are enforced by RLS (auth.uid() = owner_id). Reads load only the current
// user's saved work.
//
// Never imported from client code (filename is *.server.ts).

import { AI_MODEL, OPENROUTER_KEY_ENV } from "@/lib/ai-config";
import { generateDraft } from "@/lib/draft.server";
import type { PostIdea } from "@/lib/sample-data";

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

export type OwnerWork = {
  savedSets: SavedIdeaSet[];
  drafts: Draft[];
};

type AuthContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  claims: Record<string, unknown>;
};

/** Persist the exact three ideas + selected idea for the signed-in owner. */
export async function saveIdeaSet(
  ctx: AuthContext,
  input: {
    businessName: string;
    website: string;
    topic: string;
    isCustomTopic: boolean;
    description: string;
    ideas: PostIdea[];
    selectedIdeaIndex: number;
  },
): Promise<SavedIdeaSet> {
  if (input.ideas.length !== 3) throw new Error("exactly_3_ideas_required");
  if (input.selectedIdeaIndex < 0 || input.selectedIdeaIndex > 2) {
    throw new Error("invalid_selected_idea_index");
  }
  const { data, error } = await ctx.supabase
    .from("saved_idea_sets")
    .insert({
      owner_id: ctx.userId,
      business_name: input.businessName,
      website: input.website,
      topic: input.topic,
      is_custom_topic: input.isCustomTopic,
      description: input.description,
      ideas: input.ideas,
      selected_idea_index: input.selectedIdeaIndex,
    })
    .select()
    .single();
  if (error || !data) throw new Error("save_failed");
  return mapSavedSet(data);
}

/**
 * Generate a draft (caption + visual brief) for the selected idea on the
 * chosen platform using the existing server-side OpenRouter model. Returns
 * null if the key is missing or generation fails — the caller shows a clear
 * setup/error state and preserves the selected idea.
 */
export async function generateDraftForIdea(
  ctx: AuthContext,
  args: {
    savedSetId: string;
    platform: "facebook" | "instagram";
    idea: PostIdea;
    businessName: string;
  },
): Promise<Draft | null> {
  // Verify ownership before generating (RLS would hide it, but we need the
  // row to exist and belong to the caller to attach the draft).
  const { data: owned } = await ctx.supabase
    .from("saved_idea_sets")
    .select("id, business_name")
    .eq("id", args.savedSetId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!owned) throw new Error("not_found");

  const apiKey = process.env[OPENROUTER_KEY_ENV];
  if (!apiKey) return null;

  const generated = await generateDraft(apiKey, args.platform, owned.business_name, args.idea);
  if (!generated) return null;

  const { data, error } = await ctx.supabase
    .from("drafts")
    .insert({
      saved_set_id: args.savedSetId,
      owner_id: ctx.userId,
      platform: args.platform,
      caption: generated.caption,
      visual_brief: generated.visualBrief,
      revision: 1,
      approved: false,
    })
    .select()
    .single();
  if (error || !data) return null;
  return mapDraft(data);
}

/**
 * Save edits to a draft's caption and/or visual brief. Editing APPROVED text
 * clears the approval (approval applies to the current revision; editing
 * creates a new revision). Returns the updated draft.
 */
export async function editDraft(
  ctx: AuthContext,
  args: {
    draftId: string;
    caption?: string;
    visualBrief?: string;
  },
): Promise<Draft> {
  const { data: existing } = await ctx.supabase
    .from("drafts")
    .select("id, owner_id, caption, visual_brief, revision, approved")
    .eq("id", args.draftId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  if (!existing) throw new Error("not_found");

  const nextCaption = args.caption ?? existing.caption;
  const nextBrief = args.visualBrief ?? existing.visual_brief;
  const captionChanged = nextCaption !== existing.caption;
  const briefChanged = nextBrief !== existing.visual_brief;
  const changed = captionChanged || briefChanged;

  // Editing approved text clears approval and bumps the revision. If only the
  // same text is re-saved, nothing changes.
  const nextRevision = changed ? existing.revision + 1 : existing.revision;
  const nextApproved = changed ? false : existing.approved;

  const { data, error } = await ctx.supabase
    .from("drafts")
    .update({
      caption: nextCaption,
      visual_brief: nextBrief,
      revision: nextRevision,
      approved: nextApproved,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.draftId)
    .eq("owner_id", ctx.userId)
    .select()
    .single();
  if (error || !data) throw new Error("edit_failed");
  return mapDraft(data);
}

/** Toggle approval on the current revision. */
export async function setDraftApproval(
  ctx: AuthContext,
  args: { draftId: string; approved: boolean },
): Promise<Draft> {
  const { data, error } = await ctx.supabase
    .from("drafts")
    .update({ approved: args.approved, updated_at: new Date().toISOString() })
    .eq("id", args.draftId)
    .eq("owner_id", ctx.userId)
    .select()
    .single();
  if (error || !data) throw new Error("approval_failed");
  return mapDraft(data);
}

/** Load only the current user's saved sets + drafts. */
export async function loadOwnerWork(ctx: AuthContext): Promise<OwnerWork> {
  const [setsRes, draftsRes] = await Promise.all([
    ctx.supabase
      .from("saved_idea_sets")
      .select("*")
      .eq("owner_id", ctx.userId)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("drafts")
      .select("*")
      .eq("owner_id", ctx.userId)
      .order("updated_at", { ascending: false }),
  ]);

  const savedSets: SavedIdeaSet[] = (setsRes.data ?? []).map(mapSavedSet);
  const drafts: Draft[] = (draftsRes.data ?? []).map(mapDraft);
  return { savedSets, drafts };
}

export async function deleteSavedSet(ctx: AuthContext, savedSetId: string): Promise<void> {
  const { error } = await ctx.supabase
    .from("saved_idea_sets")
    .delete()
    .eq("id", savedSetId)
    .eq("owner_id", ctx.userId);
  if (error) throw new Error("delete_failed");
}

// --- row mappers (DB snake_case -> public camelCase) ---

type SavedSetRow = {
  id: string;
  created_at: string;
  business_name: string;
  website: string;
  topic: string;
  is_custom_topic: boolean;
  description: string;
  ideas: PostIdea[];
  selected_idea_index: number;
};

type DraftRow = {
  id: string;
  saved_set_id: string;
  updated_at: string;
  revision: number;
  platform: "facebook" | "instagram";
  caption: string;
  visual_brief: string;
  approved: boolean;
};

function mapSavedSet(r: SavedSetRow): SavedIdeaSet {
  return {
    id: r.id,
    createdAt: r.created_at,
    businessName: r.business_name,
    website: r.website,
    topic: r.topic,
    isCustomTopic: r.is_custom_topic,
    description: r.description,
    ideas: r.ideas,
    selectedIdeaIndex: r.selected_idea_index,
  };
}

function mapDraft(r: DraftRow): Draft {
  return {
    id: r.id,
    savedSetId: r.saved_set_id,
    updatedAt: r.updated_at,
    revision: r.revision,
    platform: r.platform,
    caption: r.caption,
    visualBrief: r.visual_brief,
    approved: r.approved,
  };
}

// Re-export for the server fn that reads AI_MODEL for a "configured?" check.
export const CURRENT_AI_MODEL = AI_MODEL;
