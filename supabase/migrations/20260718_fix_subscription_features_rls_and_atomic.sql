-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260718:
-- Fix RLS on subscription_features + atomic plan management via RPCs.
--
-- Problems fixed:
-- 1. subscription_features has only a FOR SELECT policy
--    → DELETE/INSERT from frontend fail with "new row violates row-level
--      security policy on table subscription_features"
--    (subscription_plans already has FOR ALL for super_admin via
--     supabase-saas-limits.sql, but subscription_features was overlooked)
-- 2. Plan updates are not atomic:
--    plan row updates succeed, but features delete+insert fails
--    → user sees partial success with error toast
-- 3. Frontend writes directly to tables instead of using secure RPCs
--    (direct table access bypasses atomicity guarantees)
--
-- Fixes:
-- - Add INSERT, UPDATE, DELETE RLS policies on subscription_features
--   for super_admin (matching existing subscription_plans policy)
-- - Create manage_subscription_plan RPC (SECURITY DEFINER):
--   atomically upserts plan + features in a single transaction
-- - Create delete_subscription_plan RPC:
--   atomically deletes plan + features
-- - Create toggle_subscription_plan_active RPC:
--   toggles the active flag on a plan
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. RLS policies on subscription_features for super_admin
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "subscription features insert super_admin" ON public.subscription_features;
CREATE POLICY "subscription features insert super_admin" ON public.subscription_features
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "subscription features update super_admin" ON public.subscription_features;
CREATE POLICY "subscription features update super_admin" ON public.subscription_features
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "subscription features delete super_admin" ON public.subscription_features;
CREATE POLICY "subscription features delete super_admin" ON public.subscription_features
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Atomic plan management RPCs (SECURITY DEFINER bypasses RLS)
-- ────────────────────────────────────────────────────────────────────────────

-- manage_subscription_plan: upsert a plan and atomically replace its features.
-- Returns the plan id.
-- If p_id is provided → update existing plan + replace features
-- If p_id is NULL → insert new plan + insert features
CREATE OR REPLACE FUNCTION public.manage_subscription_plan(
  p_id UUID,
  p_name TEXT,
  p_monthly_price NUMERIC(12,2),
  p_yearly_price NUMERIC(12,2),
  p_max_businesses INTEGER,
  p_max_branches INTEGER,
  p_max_staff INTEGER,
  p_active BOOLEAN,
  p_description TEXT,
  p_features JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_feature JSONB;
BEGIN
  -- Upsert the plan
  IF p_id IS NOT NULL THEN
    UPDATE public.subscription_plans
    SET
      name            = p_name,
      monthly_price   = p_monthly_price,
      yearly_price    = p_yearly_price,
      max_businesses  = NULLIF(p_max_businesses, 0),
      max_branches    = NULLIF(p_max_branches, 0),
      max_staff       = NULLIF(p_max_staff, 0),
      active          = p_active,
      description     = NULLIF(p_description, ''),
      updated_at      = now()
    WHERE id = p_id
    RETURNING id INTO v_plan_id;

    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'Plan with id % not found', p_id;
    END IF;

    -- Delete old features
    DELETE FROM public.subscription_features WHERE plan_id = v_plan_id;
  ELSE
    INSERT INTO public.subscription_plans (
      name, monthly_price, yearly_price,
      max_businesses, max_branches, max_staff,
      active, description
    ) VALUES (
      p_name, p_monthly_price, p_yearly_price,
      NULLIF(p_max_businesses, 0), NULLIF(p_max_branches, 0), NULLIF(p_max_staff, 0),
      p_active, NULLIF(p_description, '')
    )
    RETURNING id INTO v_plan_id;
  END IF;

  -- Insert new features
  IF p_features IS NOT NULL AND jsonb_typeof(p_features) = 'array' THEN
    INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, feature_group, sort_order)
    SELECT
      v_plan_id,
      f->>'feature_key',
      COALESCE((f->>'enabled')::BOOLEAN, true),
      f->>'feature_label',
      f->>'feature_group',
      COALESCE((f->>'sort_order')::INTEGER, 0)
    FROM jsonb_array_elements(p_features) AS f;
  END IF;

  RETURN v_plan_id;
END;
$$;

-- delete_subscription_plan: atomically delete features + plan.
CREATE OR REPLACE FUNCTION public.delete_subscription_plan(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.subscription_features WHERE plan_id = p_id;
  DELETE FROM public.subscription_plans WHERE id = p_id;
END;
$$;

-- toggle_subscription_plan_active: toggle the active flag.
CREATE OR REPLACE FUNCTION public.toggle_subscription_plan_active(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active BOOLEAN;
BEGIN
  UPDATE public.subscription_plans
  SET active = NOT active, updated_at = now()
  WHERE id = p_id
  RETURNING active INTO v_active;

  RETURN v_active;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Optional: log table for RLS/plan modification debugging
--    (reuses subscription_debug_log from migration 20260717 if it exists)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'subscription_debug_log') THEN
    INSERT INTO public.subscription_debug_log (event_type, details)
    VALUES (
      'migration_20260718_applied',
      jsonb_build_object(
        'description', 'Added RLS policies on subscription_features + atomic RPCs for plan management'
      )
    );
  END IF;
END;
$$;
