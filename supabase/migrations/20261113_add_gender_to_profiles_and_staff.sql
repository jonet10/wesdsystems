-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20261113: Add gender to profiles and support dynamic roles
-- (Caissier vs Caissière, Barbier vs Esthéticienne / Coiffeuse, Gérant vs Gérante)
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Add gender column to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'M' CHECK (gender IN ('M', 'F'));

-- 2. Update pharmacy_list_staff to return gender
CREATE OR REPLACE FUNCTION public.pharmacy_list_staff(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.can_manage_pharmacy_staff(p_business_id) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      p.id,
      p.full_name,
      p.username,
      p.email,
      p.role,
      COALESCE(p.gender, 'M') AS gender,
      p.is_active,
      p.created_at
    FROM public.profiles p
    WHERE p.business_id = p_business_id
      AND (
        p.role LIKE 'pharmacy_%'
        OR p.role_normalized LIKE 'pharmacy_%'
      )
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pharmacy_list_staff(UUID) TO authenticated;
