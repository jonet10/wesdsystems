-- Migration: Ajout de la fonction RPC delete_pharmacy_staff_member avec SECURITY DEFINER
-- Permet à l'admin de pharmacie de supprimer définitivement un compte employé ou de le désactiver/anonymiser si contrainte FK

CREATE OR REPLACE FUNCTION public.delete_pharmacy_staff_member(
  p_user_id     UUID,
  p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Vérification des autorisations admin pharmacie
  IF NOT public.can_manage_pharmacy_staff(p_business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;

  -- 1. Tentative de suppression directe dans profiles
  DELETE FROM public.profiles
  WHERE id = p_user_id AND business_id = p_business_id;

  -- 2. Tentative de suppression du compte Supabase auth
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Contrainte clé étrangère possible sur ventes / sessions existantes
  END;

  -- 3. Si le profil existe encore à cause d'une contrainte FK (ventes passées, caisses...) :
  -- Anonymiser le profil et le marquer supprimé (role = 'deleted', is_active = false)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    UPDATE public.profiles
    SET
      is_active = false,
      role = 'deleted',
      role_normalized = 'deleted',
      username = 'supprime_' || substr(md5(random()::text), 1, 8)
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_pharmacy_staff_member(UUID, UUID) TO authenticated;
