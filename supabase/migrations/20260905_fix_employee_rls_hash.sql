-- Migration to fix current_user_business_id hash check for employee sessions
-- Employee sessions use crypt() for session_token_hash, not sha256.

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
      WHERE s.session_token_hash = crypt(current_setting('request.headers', true)::json->>'x-employee-session', s.session_token_hash)
        AND s.revoked_at IS NULL 
        AND s.expires_at > now() 
      LIMIT 1
    ),
    
    -- 3. Staff Session fallback (just in case)
    (
      SELECT b.business_id 
      FROM public.employee_sessions s 
      JOIN public.salon_branches b ON b.id = s.branch_id 
      WHERE s.session_token_hash = crypt(current_setting('request.headers', true)::json->>'x-staff-session', s.session_token_hash)
        AND s.revoked_at IS NULL 
        AND s.expires_at > now() 
      LIMIT 1
    )
  );
$$;
