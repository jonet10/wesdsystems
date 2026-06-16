-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS / MULTI-MODULE
-- Add business_type to business_branches so an enterprise can have branches
-- acting as different modules (e.g. Branch A = auto_parts, Branch B = salon)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.business_branches
  ADD COLUMN IF NOT EXISTS business_type TEXT;

-- Pour les succursales existantes, on copie le type de l'entreprise mère
UPDATE public.business_branches bb
SET business_type = b.type
FROM public.businesses b
WHERE bb.business_id = b.id
  AND bb.business_type IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN RAISE NOTICE 'Migration 20260817 applied: added business_type to business_branches'; END $$;
