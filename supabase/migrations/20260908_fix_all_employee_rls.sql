-- ============================================================================
-- Fix current_user_business_id() for ALL Employee Types (Salon & Auto Parts)
-- ============================================================================
-- The previous migrations incorrectly assumed crypt() was used for hashing,
-- but both salon_employees and auto_parts_staff use sha256 for their session tokens.
-- This migration restores the correct sha256 hash checks and unifies the header 
-- to x-staff-session for both modules.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    -- 1. Regular Supabase Auth User (Admin)
    (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    
    -- 2. Salon Employee via Custom HTTP Header
    (
      SELECT b.business_id 
      FROM public.employee_sessions s 
      JOIN public.salon_branches b ON b.id = s.branch_id 
      WHERE s.session_token_hash = encode(digest(COALESCE(current_setting('request.headers', true)::json->>'x-staff-session', ''), 'sha256'), 'hex')
        AND s.revoked_at IS NULL 
        AND s.expires_at > now() 
      LIMIT 1
    ),

    -- 3. Auto Parts Staff via Custom HTTP Header
    (
      SELECT s.business_id 
      FROM public.auto_parts_staff_sessions s 
      WHERE s.session_token_hash = encode(digest(COALESCE(current_setting('request.headers', true)::json->>'x-staff-session', ''), 'sha256'), 'hex')
        AND s.revoked_at IS NULL 
        AND s.expires_at > now() 
      LIMIT 1
    )
  );
$$;
