-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260720:
-- Create app_config table for dynamic configuration (support contacts,
-- payment account numbers, etc.) editable from Super Admin panel.
--
-- This replaces hardcoded values in payment-providers.ts and
-- SubscriptionPaymentCard.tsx.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read config values
DROP POLICY IF EXISTS "app_config readable by all" ON public.app_config;
CREATE POLICY "app_config readable by all" ON public.app_config
  FOR SELECT USING (true);

-- Only super_admin can modify
DROP POLICY IF EXISTS "app_config write super_admin" ON public.app_config;
CREATE POLICY "app_config write super_admin" ON public.app_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
    )
  );

-- Seed default values
INSERT INTO public.app_config (key, value, description) VALUES
  ('support_whatsapp', '38073835', 'Numéro WhatsApp pour support client / paiement manuel'),
  ('support_phone', '31966855', 'Numéro de téléphone pour appels support'),
  ('payment_account_moncash', '31966855', 'Compte MonCash pour réception des paiements'),
  ('payment_account_natcash', '31966855', 'Compte NatCash pour réception des paiements'),
  ('payment_account_name', 'WesdSystems', 'Nom du bénéficiaire affiché pour les paiements')
ON CONFLICT (key) DO NOTHING;

-- RPC to upsert config values (called from Super Admin panel)
CREATE OR REPLACE FUNCTION public.upsert_app_config(
  p_key TEXT,
  p_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now(),
    updated_by = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_app_config TO authenticated;

-- RPC to get all config as a JSON object
CREATE OR REPLACE FUNCTION public.get_app_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_object_agg(key, value)
  INTO v_result
  FROM public.app_config;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_config TO anon, authenticated, service_role;
