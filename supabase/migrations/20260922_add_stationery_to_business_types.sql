-- ============================================================================
-- Fix businesses_type_check to allow 'stationery' accounts
-- ============================================================================

-- 1. Drop the existing constraint
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_check;

-- 2. Re-create the constraint with 'stationery' added to the list
ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_check
  CHECK (type = ANY (ARRAY['salon'::text, 'pharmacie'::text, 'restaurant'::text, 'market'::text, 'boutique'::text, 'auto_parts'::text, 'school'::text, 'stationery'::text]));
