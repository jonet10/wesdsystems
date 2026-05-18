-- ═══════════════════════════════════════════════════════════
-- WESD SYSTEMS — Migration Sécurisée du Trigger
-- À exécuter dans Supabase → SQL Editor
-- ROLLBACK: DROP FUNCTION public.handle_new_user() CASCADE;
--           puis recréer l'ancienne version.
-- ═══════════════════════════════════════════════════════════

-- Remplace la fonction existante (pas de DROP TABLE, zéro risque)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_biz_id UUID;
BEGIN
  -- 1. Créer automatiquement l'entreprise (Tenant)
  INSERT INTO public.businesses (name, type, plan, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', 'Mon Entreprise'),
    COALESCE(NEW.raw_user_meta_data->>'business_type', 'salon'),
    COALESCE(NEW.raw_user_meta_data->>'plan', 'starter'),
    NEW.id
  ) RETURNING id INTO new_biz_id;

  -- 2. Créer le profil ET le lier à l'entreprise
  INSERT INTO public.profiles (id, full_name, role, business_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
    'owner',
    new_biz_id
  );

  RETURN NEW;
END;
$$;

-- Recréer le trigger proprement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
