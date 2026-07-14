-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — School Engine Production Ready Migration
-- Date: 2026-09-28
--
-- 1. Mettre à jour la contrainte de type de business pour inclure 'school_payments'
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Mettre à jour la contrainte de validation des types de business ───
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_check;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_check
  CHECK (type = ANY (ARRAY[
    'salon'::text, 
    'pharmacie'::text, 
    'restaurant'::text, 
    'market'::text, 
    'boutique'::text, 
    'auto_parts'::text, 
    'school'::text, 
    'school_payments'::text, 
    'stationery'::text
  ]));
