-- Fix: claim_and_save_ideas referenced a non-existent column "claim_at"
-- (the real column is "claimed_at"), so every call threw a Postgres error
-- and no saved_idea_sets row was ever inserted. Recreate the function with
-- the correct column name. Transactional rollback + owner isolation are
-- preserved: an insert failure still propagates and rolls back the claim.

CREATE OR REPLACE FUNCTION public.claim_and_save_ideas(
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

  IF v_row.claimed_at IS NOT NULL THEN
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

  INSERT INTO public.saved_idea_sets (
    owner_id, business_name, website, topic, is_custom_topic,
    description, ideas, selected_idea_index
  ) VALUES (
    _user_id, v_row.business_name, v_row.website, v_row.topic, v_row.is_custom_topic,
    v_row.description, v_row.ideas, v_row.selected_idea_index
  )
  RETURNING id INTO v_new;

  UPDATE public.pending_idea_claims
     SET claimed_by = _user_id,
         claimed_at = now(),
         saved_set_id = v_new
   WHERE id = v_row.id;

  RETURN QUERY SELECT v_new, 'ok'::text;
END;
$$;

-- Re-assert service_role-only execution posture.
REVOKE EXECUTE ON FUNCTION public.claim_and_save_ideas(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_and_save_ideas(text, text, uuid) TO service_role;