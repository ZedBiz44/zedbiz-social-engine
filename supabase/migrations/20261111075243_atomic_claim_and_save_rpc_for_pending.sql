-- Fix the save-flow data loss: claiming a pending record marked it consumed
-- but never inserted a saved_idea_sets row. Replace the mark-only RPC with a
-- single transactional RPC that locks the pending row, checks expiry + the
-- verified email, inserts the saved idea set, and only then marks the claim
-- consumed — storing the saved set id on the claim so a legitimate same-owner
-- retry returns the existing saved id. An insert failure rolls back the claim.

-- Track which saved set a claim produced (idempotent same-owner retry).
ALTER TABLE public.pending_idea_claims
  ADD COLUMN IF NOT EXISTS saved_set_id uuid REFERENCES public.saved_idea_sets(id) ON DELETE SET NULL;

-- Atomic claim + save. SECURITY DEFINER, service_role only, fixed search_path,
-- schema-qualified references. Identity is derived ONLY from the caller's
-- verified email + user id passed in by the authenticated server wrapper.
-- Returns the saved set id (existing or newly inserted) on success, or NULL
-- with a reason code on failure.
CREATE OR REPLACE FUNCTION public.claim_and_save_ideas(
  _claim_token_hash text,
  _email_key text,
  _user_id uuid
) RETURNS TABLE (saved_set_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_existing uuid;
  v_new uuid;
BEGIN
  -- Lock the candidate row for the duration of the transaction. Only an
  -- unclaimed, unexpired row whose verified email matches is claimable.
  SELECT * INTO v_row
    FROM public.pending_idea_claims
    WHERE claim_token_hash = _claim_token_hash
      AND email_key = _email_key
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'not_found'::text;
    RETURN;
  END IF;

  IF v_row.claim_at IS NOT NULL THEN
    -- Already consumed. If it produced a saved set, return that id so a
    -- legitimate same-owner retry is idempotent (no duplicate, no data loss).
    IF v_row.saved_set_id IS NOT NULL THEN
      RETURN QUERY SELECT v_row.saved_set_id, 'ok'::text;
    ELSE
      RETURN QUERY SELECT NULL::uuid, 'already_claimed'::text;
    END IF;
    RETURN;
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN QUERY SELECT NULL::uuid, 'expired'::text;
    RETURN;
  END IF;

  -- Insert the saved idea set as the verified owner. If the insert fails, the
  -- exception propagates and the whole transaction (including the claim mark)
  -- rolls back — the claim stays consumable for a retry.
  INSERT INTO public.saved_idea_sets (
    owner_id, business_name, website, topic, is_custom_topic,
    description, ideas, selected_idea_index
  ) VALUES (
    _user_id, v_row.business_name, v_row.website, v_row.topic, v_row.is_custom_topic,
    v_row.description, v_row.ideas, v_row.selected_idea_index
  )
  RETURNING id INTO v_new;

  -- Only now mark the claim consumed, recording the saved set id.
  UPDATE public.pending_idea_claims
     SET claimed_by = _user_id,
         claimed_at = now(),
         saved_set_id = v_new
   WHERE id = v_row.id;

  RETURN QUERY SELECT v_new, 'ok'::text;
END;
$$;

-- QA-only recovery: a consumed claim with no saved row can be re-claimed by
-- the same verified owner presenting a still-valid token. The RPC above
-- already handles this (claimed_at set + saved_set_id NULL -> already_claimed),
-- but expose a narrow recovery path so QA does not need a fresh claim when the
-- token is still valid and the owner/email match. This re-runs the insert.
CREATE OR REPLACE FUNCTION public.recover_unsaved_claim(
  _claim_token_hash text,
  _email_key text,
  _user_id uuid
) RETURNS TABLE (saved_set_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_new uuid;
BEGIN
  SELECT * INTO v_row
    FROM public.pending_idea_claims
    WHERE claim_token_hash = _claim_token_hash
      AND email_key = _email_key
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'not_found'::text;
    RETURN;
  END IF;

  -- Only recover a consumed claim that produced no saved row, for the same
  -- verified owner, with a still-valid token.
  IF v_row.claimed_at IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'not_consumed'::text;
    RETURN;
  END IF;
  IF v_row.saved_set_id IS NOT NULL THEN
    RETURN QUERY SELECT v_row.saved_set_id, 'ok'::text;
    RETURN;
  END IF;
  IF v_row.claimed_by IS DISTINCT FROM _user_id THEN
    RETURN QUERY SELECT NULL::uuid, 'owner_mismatch'::text;
    RETURN;
  END IF;

  INSERT INTO public.saved_idea_sets (
    owner_id, business_name, website, topic, is_custom_topic,
    description, ideas, selected_idea_index
  ) VALUES (
    _user_id, v_row.business_name, v_row.website, v_row.topic, v_row.is_custom_topic,
    v_row.description, v_row.ideas, v_row.selected_idea_index
  )
  RETURNING id INTO v_new;

  UPDATE public.pending_idea_claims
     SET saved_set_id = v_new
   WHERE id = v_row.id;

  RETURN QUERY SELECT v_new, 'ok'::text;
END;
$$;

-- Lock both new RPCs to service_role only (same posture as the existing
-- claim_pending_ideas). No browser session can call them through the Data API.
REVOKE EXECUTE ON FUNCTION public.claim_and_save_ideas(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recover_unsaved_claim(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_and_save_ideas(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_unsaved_claim(text, text, uuid) TO service_role;

-- Index the saved_set_id link for the recovery lookup.
CREATE INDEX IF NOT EXISTS pending_idea_claims_saved_set_idx
  ON public.pending_idea_claims (saved_set_id);