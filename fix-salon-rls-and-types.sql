-- ============================================================================
-- WESD SYSTEMS - FIX FOR SALON MODULE
-- Fixes:
-- 1. Type mismatch in public.get_effective_plan (sp.name is character varying, needs TEXT cast)
-- 2. Missing RLS policies on salon_service_categories (Select, Insert, Update, Delete)
-- 3. Missing RLS policies on salon_services (Insert, Update, Delete)
-- 4. Missing RLS policies on salon_branches (Insert, Update, Delete)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recreate get_effective_plan with correct type casting (::TEXT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_business_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  max_businesses INTEGER,
  max_branches INTEGER,
  max_staff INTEGER,
  active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.name::TEXT, sp.max_businesses, sp.max_branches, sp.max_staff, sp.active
  FROM public.business_subscriptions bs
  JOIN public.subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.business_id = p_business_id
    AND bs.status = 'active'
  ORDER BY bs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT sp.id, sp.name::TEXT, sp.max_businesses, sp.max_branches, sp.max_staff, sp.active
    FROM public.businesses b
    JOIN public.subscription_plans sp ON sp.id = b.plan_id
    WHERE b.id = p_business_id
    LIMIT 1;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Add RLS Policies for salon_service_categories
-- ----------------------------------------------------------------------------
ALTER TABLE public.salon_service_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "salon_service_categories_select" ON public.salon_service_categories 
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_service_categories_insert" ON public.salon_service_categories 
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_service_categories_update" ON public.salon_service_categories 
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_service_categories_delete" ON public.salon_service_categories 
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. Add missing RLS Policies for salon_services
-- ----------------------------------------------------------------------------
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "salon_services_select" ON public.salon_services 
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_services_insert" ON public.salon_services 
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_services_update" ON public.salon_services 
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_services_delete" ON public.salon_services 
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. Add missing RLS Policies for salon_branches
-- ----------------------------------------------------------------------------
ALTER TABLE public.salon_branches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "salon_branches_select" ON public.salon_branches 
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_branches_insert" ON public.salon_branches 
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_branches_update" ON public.salon_branches 
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "salon_branches_delete" ON public.salon_branches 
    FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
