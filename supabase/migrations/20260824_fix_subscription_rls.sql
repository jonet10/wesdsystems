-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260824: Fix RLS policies on business_subscriptions
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Supprimer les anciennes politiques conflictuelles
DROP POLICY IF EXISTS "business subscriptions owner read" ON public.business_subscriptions;
DROP POLICY IF EXISTS "business subscriptions owner manage" ON public.business_subscriptions;
DROP POLICY IF EXISTS "business subscriptions partner read" ON public.business_subscriptions;
DROP POLICY IF EXISTS "business subscriptions partner manage" ON public.business_subscriptions;

-- 2. Créer une politique de lecture propre
CREATE POLICY "business subscriptions read" ON public.business_subscriptions
  FOR SELECT USING (
    public.is_super_admin()
    OR business_id = public.current_user_business_id()
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_subscriptions.business_id
        AND b.referred_by_partner_id IN (SELECT partner_id FROM public.current_user_partner_ids())
    )
  );

-- 3. Créer une politique d'écriture/gestion propre
CREATE POLICY "business subscriptions manage" ON public.business_subscriptions
  FOR ALL USING (
    public.is_super_admin()
    OR business_id = public.current_user_business_id()
  );
