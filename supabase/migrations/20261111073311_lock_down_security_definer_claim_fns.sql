-- Neither SECURITY DEFINER function is called from an RLS policy; both are
-- invoked server-side through the service-role client only. Revoke EXECUTE
-- from PUBLIC, anon, and authenticated so no browser session can call them
-- through the Data API. service_role keeps EXECUTE (used by supabaseAdmin).
REVOKE EXECUTE ON FUNCTION public.claim_pending_ideas(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_ideas(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO service_role;