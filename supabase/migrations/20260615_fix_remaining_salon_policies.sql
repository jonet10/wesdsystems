-- ============================================================================
-- WESD SYSTEMS - Fix remaining permissive salon policies
-- Date: 2026-06-15
--
-- This migration removes the old permissive policies reported by the audit
-- and replaces them with tenant-aware policies.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Keep using the shared helpers
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

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'super_admin', false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- salon_branches
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.salon_branches') IS NOT NULL THEN
    DROP POLICY IF EXISTS salon_branches_delete ON public.salon_branches;
    DROP POLICY IF EXISTS salon_branches_tenant_guard ON public.salon_branches;

    CREATE POLICY salon_branches_tenant_guard ON public.salon_branches
      FOR ALL
      USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
      WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- salon_service_categories
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.salon_service_categories') IS NOT NULL THEN
    DROP POLICY IF EXISTS salon_service_categories_select ON public.salon_service_categories;
    DROP POLICY IF EXISTS salon_service_categories_insert ON public.salon_service_categories;
    DROP POLICY IF EXISTS salon_service_categories_update ON public.salon_service_categories;
    DROP POLICY IF EXISTS salon_service_categories_delete ON public.salon_service_categories;
    DROP POLICY IF EXISTS salon_service_categories_tenant_guard ON public.salon_service_categories;

    CREATE POLICY salon_service_categories_tenant_guard ON public.salon_service_categories
      FOR ALL
      USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
      WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- salon_promotions
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.salon_promotions') IS NOT NULL THEN
    DROP POLICY IF EXISTS salon_promotions_insert ON public.salon_promotions;
    DROP POLICY IF EXISTS salon_promotions_update ON public.salon_promotions;
    DROP POLICY IF EXISTS salon_promotions_tenant_guard ON public.salon_promotions;

    CREATE POLICY salon_promotions_tenant_guard ON public.salon_promotions
      FOR ALL
      USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
      WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "System can insert notifications for users" ON public.notifications;
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS notifications_tenant_guard ON public.notifications;

    CREATE POLICY notifications_tenant_guard ON public.notifications
      FOR ALL
      USING (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR salon_id = public.current_user_business_id()
      )
      WITH CHECK (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR salon_id = public.current_user_business_id()
      );
  END IF;
END $$;

