-- ============================================================================
-- Bridging Employee and Staff Sessions to RLS via HTTP Headers
-- ============================================================================
-- This migration redefines `public.current_user_business_id()` so that it 
-- can authenticate requests made by employees and staff members who log in 
-- via PIN and do not have a standard Supabase auth.uid().
-- It reads the custom headers injected by the frontend client and validates
-- them against the active sessions in the database.
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
      WHERE s.session_token_hash = encode(digest(current_setting('request.headers', true)::json->>'x-employee-session', 'sha256'), 'hex') 
        AND s.revoked_at IS NULL 
        AND s.expires_at > now() 
      LIMIT 1
    ),
    
    -- 3. Auto Parts Staff via Custom HTTP Header
    (
      SELECT s.business_id 
      FROM public.auto_parts_staff_sessions s 
      WHERE s.session_token_hash = encode(digest(current_setting('request.headers', true)::json->>'x-staff-session', 'sha256'), 'hex') 
        AND s.expires_at > now() 
      LIMIT 1
    )
  );
$$;
