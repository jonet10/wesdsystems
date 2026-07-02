-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS DATABASE COMPATIBILITY FIX
-- Fixes RLS policies and trigger function referencing non-existent salon_id
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Redéfinir la fonction de synchronisation pour utiliser business_id
CREATE OR REPLACE FUNCTION public.sync_auto_parts_business_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Synchronise business_id sur la ligne
  NEW.business_id := COALESCE(NEW.business_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

-- 2. Recréer les triggers pour appeler la bonne fonction
DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories', 'auto_parts_products', 'auto_parts_suppliers',
    'auto_parts_clients', 'auto_parts_stock_movements', 'auto_parts_sales',
    'auto_parts_purchases', 'auto_parts_alerts', 'auto_parts_vehicle_compatibilities'
  ]) LOOP
    -- Supprimer l'ancien trigger incorrect qui référence salon_id
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', format('trg_%s_sync_salon_id', tbl), tbl);
    -- Supprimer également le nouveau s'il existe déjà
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', format('trg_%s_sync_business_id', tbl), tbl);
    
    -- Créer le trigger correct
    EXECUTE format('
      CREATE TRIGGER %I
        BEFORE INSERT OR UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.sync_auto_parts_business_id();
    ', format('trg_%s_sync_business_id', tbl), tbl);
  END LOOP;
END $$;

-- 3. Recréer les politiques RLS pour utiliser business_id
DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories', 'auto_parts_products', 'auto_parts_suppliers',
    'auto_parts_clients', 'auto_parts_stock_movements', 'auto_parts_sales',
    'auto_parts_purchases', 'auto_parts_alerts', 'auto_parts_vehicle_compatibilities'
  ]) LOOP
    -- Supprimer l'ancienne politique incorrecte
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', format('%s_tenant_guard', tbl), tbl);
    
    -- Créer la politique correcte avec business_id
    EXECUTE format('
      CREATE POLICY %I ON public.%I
        FOR ALL
        USING (public.is_super_admin() OR business_id = public.current_user_business_id())
        WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
    ', format('%s_tenant_guard', tbl), tbl);
  END LOOP;
END $$;
