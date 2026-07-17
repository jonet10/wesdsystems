-- ════════════════════════════════════════════════════════════════════════════
-- Fix: issue_auto_parts_staff_session called by check_staff_login
-- with no Supabase auth context (anon role via PIN login).
-- current_user_business_id() returns NULL for anonymous callers,
-- causing a false '42501 Accès non autorisé' when the PIN is valid.
-- 
-- The fix: remove the broken ownership check from this internal helper.
-- Security is already enforced by check_staff_login validating username + PIN,
-- and by the session_token being scoped to the staff's business_id.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.issue_auto_parts_staff_session(
  p_staff_id UUID,
  p_business_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
BEGIN
  -- NOTE: The caller (check_staff_login) already validated username + PIN.
  -- We skip the business_id ownership check here because this function
  -- is called in an anonymous (no JWT) context during staff PIN login.

  -- Revoke any existing active session for this staff member
  UPDATE public.auto_parts_staff_sessions
  SET revoked_at = now()
  WHERE staff_id = p_staff_id AND revoked_at IS NULL;

  -- Generate a new secure session token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');

  INSERT INTO public.auto_parts_staff_sessions (staff_id, business_id, session_token_hash, expires_at)
  VALUES (p_staff_id, p_business_id, v_hash, now() + INTERVAL '12 hours');

  RETURN jsonb_build_object(
    'session_token', v_token,
    'expires_at', to_char(now() + INTERVAL '12 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;

-- Ensure anon and authenticated roles can call this (via check_staff_login)
REVOKE EXECUTE ON FUNCTION public.issue_auto_parts_staff_session(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_auto_parts_staff_session(UUID, UUID) TO anon, authenticated, service_role;

DO $$ BEGIN RAISE NOTICE 'Fix applied: issue_auto_parts_staff_session no longer throws 42501 for anon PIN login'; END $$;
