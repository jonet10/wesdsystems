-- 20261111: Affectation d'une caissière à une caisse
--
-- Objectif :
--   * permettre aux gérants (pharmacy_manager) de lister les employés de leur
--     pharmacie afin de les affecter à une caisse ;
--   * exposer une liste de caissiers/employés actifs aux autres utilisateurs
--     de la pharmacie (caissier, comptable...) sans donner accès à la gestion
--     complète des comptes.
--
-- Ces fonctions sont en SECURITY DEFINER pour contourner la RLS de profiles
-- (qui n'autorise la lecture que de son propre profil).

CREATE OR REPLACE FUNCTION public.can_manage_pharmacy_staff(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id = p_business_id
        AND COALESCE(p.role_normalized, p.role) IN (
          'salon_admin',
          'studio_admin',
          'owner',
          'business_owner',
          'pharmacy_admin',
          'pharmacy_manager'
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_pharmacy_staff(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.pharmacy_list_cashiers(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Tout utilisateur rattaché à la pharmacie peut lire la liste des employés
  -- actifs (nécessaire pour affecter une caissière à une caisse).
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.business_id = p_business_id
      AND (
        p.role LIKE 'pharmacy_%'
        OR p.role_normalized LIKE 'pharmacy_%'
        OR COALESCE(p.role_normalized, p.role) IN (
          'salon_admin',
          'studio_admin',
          'owner',
          'business_owner'
        )
      )
  ) THEN
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
      p.is_active,
      p.created_at
    FROM public.profiles p
    WHERE p.business_id = p_business_id
      AND p.is_active = true
      AND (p.role LIKE 'pharmacy_%' OR p.role_normalized LIKE 'pharmacy_%')
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pharmacy_list_cashiers(UUID) TO authenticated;
