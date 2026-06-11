-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Enable RLS on vehicle_generations (missing table)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add salon_id for consistency with other tenant tables ───
ALTER TABLE public.auto_parts_vehicle_generations
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- ─── 2. Enable RLS ───
ALTER TABLE public.auto_parts_vehicle_generations ENABLE ROW LEVEL SECURITY;

-- ─── 3. Tenant guard policy ───
DROP POLICY IF EXISTS auto_parts_vehicle_generations_tenant_guard ON public.auto_parts_vehicle_generations;
CREATE POLICY auto_parts_vehicle_generations_tenant_guard ON public.auto_parts_vehicle_generations
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 4. Read policy for authenticated users (shared reference data) ───
DROP POLICY IF EXISTS auto_parts_vehicle_generations_read ON public.auto_parts_vehicle_generations;
CREATE POLICY auto_parts_vehicle_generations_read ON public.auto_parts_vehicle_generations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── 5. Trigger to auto-set salon_id on insert/update ───
DROP TRIGGER IF EXISTS trg_auto_parts_vehicle_generations_sync_salon_id ON public.auto_parts_vehicle_generations;
CREATE TRIGGER trg_auto_parts_vehicle_generations_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.auto_parts_vehicle_generations
  FOR EACH ROW EXECUTE FUNCTION public.sync_auto_parts_salon_id();

DO $$ BEGIN RAISE NOTICE 'RLS activée sur auto_parts_vehicle_generations'; END $$;
