-- ============================================================================
-- Fix branch-scoped salon_id sync
-- ============================================================================
-- The previous implementation referenced NEW.business_id inside a trigger used
-- by branch-scoped tables such as salon_service_categories and salon_products.
-- Those tables do not have a business_id column, which caused:
--   record "new" has no field "business_id"
-- This replaces the trigger function with branch-aware logic only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_branch_salon_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.business_id
      INTO v_salon_id
    FROM public.salon_branches b
    WHERE b.id = NEW.branch_id
    LIMIT 1;
  END IF;

  NEW.salon_id := COALESCE(v_salon_id, NEW.salon_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

