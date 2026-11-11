-- Social Media Machine — owner save / draft / claim schema.
-- Three user-owned tables with per-owner RLS, plus short-lived pending
-- claim records used to preserve the exact three ideas + selected idea
-- before sign-in and surface them after email verification.

-- Normalise an email to a stable key (lowercase, trimmed). SECURITY DEFINER
-- so the function works regardless of the caller's search_path.
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(trim(coalesce(_email, '')));
$$;

-- ---------------------------------------------------------------------------
-- saved_idea_sets: the exact three ideas an owner chose to save.
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_idea_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  business_name text NOT NULL,
  website text NOT NULL,
  topic text NOT NULL,
  is_custom_topic boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  -- Exact three ideas preserved at save time (hook/angle/takeaway).
  ideas jsonb NOT NULL,
  -- Index (0..2) of the idea the owner selected to draft.
  selected_idea_index smallint NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_idea_sets TO authenticated;
GRANT ALL ON public.saved_idea_sets TO service_role;
ALTER TABLE public.saved_idea_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own saved idea sets"
  ON public.saved_idea_sets FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts own saved idea sets"
  ON public.saved_idea_sets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates own saved idea sets"
  ON public.saved_idea_sets FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes own saved idea sets"
  ON public.saved_idea_sets FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- drafts: editable caption + visual brief for Facebook or Instagram,
-- built from one saved set's selected idea. Approval applies to the
-- current revision; editing the text clears approval.
-- ---------------------------------------------------------------------------
CREATE TABLE public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_set_id uuid REFERENCES public.saved_idea_sets(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Monotonic revision counter; approval applies to the current revision.
  revision integer NOT NULL DEFAULT 1,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram')),
  caption text NOT NULL,
  visual_brief text NOT NULL,
  -- True only for the current revision; editing the text clears it.
  approved boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own drafts"
  ON public.drafts FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts own drafts"
  ON public.drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates own drafts"
  ON public.drafts FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes own drafts"
  ON public.drafts FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- pending_idea_claims: short-lived records tying the exact three ideas +
-- selected idea to a normalized email, claimable after the signed-in
-- user's confirmed email matches. These are NEVER exposed to the browser
-- (only an opaque one-time claim token is returned). Pre-auth rate
-- limiting is enforced per normalized email.
-- ---------------------------------------------------------------------------
CREATE TABLE public.pending_idea_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,
  -- SHA-256 hash of the one-time claim token. The raw token is never stored.
  claim_token_hash text NOT NULL,
  -- The exact ideas + selected idea to surface on claim.
  business_name text NOT NULL,
  website text NOT NULL,
  topic text NOT NULL,
  is_custom_topic boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  ideas jsonb NOT NULL,
  selected_idea_index smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- NULL until claimed; once set, the record is not claimable again.
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz
);

-- pending_idea_claims is touched only by the server (service_role) — no
-- anon/authenticated grants — so it is not reachable through the Data API
-- by any browser session and cannot be enumerated. RLS hardens that.
GRANT ALL ON public.pending_idea_claims TO service_role;
ALTER TABLE public.pending_idea_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access to pending claims"
  ON public.pending_idea_claims FOR SELECT TO authenticated
  USING (false);

-- Atomic, idempotent claim: matches by claim-token hash, verifies the
-- caller's confirmed email matches the row's email_key, rejects already-
-- claimed or expired rows, and marks the row claimed in the same
-- transaction. Returns the row id + ideas when claimed, null when not.
CREATE OR REPLACE FUNCTION public.claim_pending_ideas(
  _claim_token_hash text,
  _email_key text,
  _user_id uuid
) RETURNS TABLE (id uuid, ideas jsonb, selected_idea_index smallint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.pending_idea_claims
     SET claimed_by = _user_id,
         claimed_at = now()
   WHERE claim_token_hash = _claim_token_hash
     AND claimed_at IS NULL
     AND expires_at > now()
     AND email_key = _email_key
  RETURNING id, ideas, selected_idea_index;
$$;

-- Indexes for the claim lookup and the per-email rate limit window.
CREATE INDEX pending_idea_claims_token_hash_idx
  ON public.pending_idea_claims (claim_token_hash);
CREATE INDEX pending_idea_claims_email_created_idx
  ON public.pending_idea_claims (email_key, created_at);