-- ============================================================================
-- Fix RLS recursion on public.businesses
-- ============================================================================
--
-- The previous businesses policy read public.profiles and public.partners
-- directly. Those tables also participate in RLS evaluation, which could
-- create a recursive policy loop when fetching / updating businesses.
--
-- These SECURITY DEFINER helpers read the user context without re-entering
-- the row-level policies, then the businesses policies use those helpers.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.business_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_partner_ids()
RETURNS TABLE(partner_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS partner_id
  FROM public.partners p
  WHERE p.user_id = auth.uid();
$$;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses partner-aware read" ON public.businesses;
CREATE POLICY "businesses partner-aware read" ON public.businesses
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR id = public.current_user_business_id()
      OR referred_by_partner_id IN (
        SELECT partner_id FROM public.current_user_partner_ids()
      )
    )
  );

DROP POLICY IF EXISTS "businesses partner-aware manage" ON public.businesses;
CREATE POLICY "businesses partner-aware manage" ON public.businesses
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR id = public.current_user_business_id()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR id = public.current_user_business_id()
    )
  );

GRANT EXECUTE ON FUNCTION public.current_user_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_partner_ids() TO authenticated;
