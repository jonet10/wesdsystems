-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Business settings (company info, legal, banking, docs)
--
-- Stores all business configuration for the auto-parts module:
--   - Company identity (name, logo, address, contacts)
--   - Legal identifiers (NIF, patente, RC)
--   - Banking info
--   - Document prefixes (invoice, quote, delivery note)
--   - Receipt footer / custom text
--   - Stock alert threshold
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auto_parts_business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  -- Company identity
  company_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  slogan TEXT,
  whatsapp TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Legal (Haïti DGI)
  nif TEXT,
  patente TEXT,
  rc TEXT,

  -- Banking
  bank_name TEXT,
  bank_account TEXT,

  -- Document configuration
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  quote_prefix TEXT NOT NULL DEFAULT 'DEV-',
  delivery_note_prefix TEXT NOT NULL DEFAULT 'BL-',

  -- POS receipt
  receipt_footer TEXT,
  receipt_header TEXT,

  -- Stock alerts
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_business_settings UNIQUE (business_id)
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.auto_parts_business_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_parts_business_settings_updated_at ON public.auto_parts_business_settings;
CREATE TRIGGER trg_auto_parts_business_settings_updated_at
  BEFORE UPDATE ON public.auto_parts_business_settings
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_business_settings_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.auto_parts_business_settings ENABLE ROW LEVEL SECURITY;

-- Add columns if missing (for existing databases)
ALTER TABLE public.auto_parts_business_settings ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE public.auto_parts_business_settings ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Allow access if the user owns the business via business_owner check
CREATE POLICY "auto_parts_business_settings_select"
  ON public.auto_parts_business_settings
  FOR SELECT
  USING (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.profiles p ON p.business_id = b.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "auto_parts_business_settings_insert"
  ON public.auto_parts_business_settings
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.profiles p ON p.business_id = b.id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "auto_parts_business_settings_update"
  ON public.auto_parts_business_settings
  FOR UPDATE
  USING (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.profiles p ON p.business_id = b.id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT b.id FROM public.businesses b
      JOIN public.profiles p ON p.business_id = b.id
      WHERE p.id = auth.uid()
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- RPC: get_auto_parts_business_settings
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_auto_parts_business_settings(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT row_to_json(t)::JSONB INTO v_result
  FROM (
    SELECT id, business_id, company_name, logo_url, slogan, whatsapp, address, phone, email, website,
           nif, patente, rc, bank_name, bank_account,
           invoice_prefix, quote_prefix, delivery_note_prefix,
           receipt_footer, receipt_header, low_stock_threshold,
           created_at, updated_at
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id
    LIMIT 1
  ) t;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- RPC: upsert_auto_parts_business_settings
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_business_settings(
  p_business_id UUID,
  p_company_name TEXT DEFAULT '',
  p_logo_url TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_nif TEXT DEFAULT NULL,
  p_patente TEXT DEFAULT NULL,
  p_rc TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account TEXT DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT 'INV-',
  p_quote_prefix TEXT DEFAULT 'DEV-',
  p_delivery_note_prefix TEXT DEFAULT 'BL-',
  p_receipt_footer TEXT DEFAULT NULL,
  p_receipt_header TEXT DEFAULT NULL,
  p_low_stock_threshold INTEGER DEFAULT 5
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_belongs BOOLEAN;
BEGIN
  -- Verify ownership
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.profiles p ON p.business_id = b.id
    WHERE b.id = p_business_id AND p.id = auth.uid()
  ) INTO v_belongs;

  IF NOT v_belongs THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  INSERT INTO public.auto_parts_business_settings
    (business_id, company_name, logo_url, slogan, whatsapp, address, phone, email, website,
     nif, patente, rc, bank_name, bank_account,
     invoice_prefix, quote_prefix, delivery_note_prefix,
     receipt_footer, receipt_header, low_stock_threshold)
  VALUES
    (p_business_id, p_company_name, p_logo_url, p_slogan, p_whatsapp, p_address, p_phone, p_email, p_website,
     p_nif, p_patente, p_rc, p_bank_name, p_bank_account,
     p_invoice_prefix, p_quote_prefix, p_delivery_note_prefix,
     p_receipt_footer, p_receipt_header, p_low_stock_threshold)
  ON CONFLICT (business_id) DO UPDATE SET
    company_name          = EXCLUDED.company_name,
    logo_url              = EXCLUDED.logo_url,
    slogan                = EXCLUDED.slogan,
    whatsapp              = EXCLUDED.whatsapp,
    address               = EXCLUDED.address,
    phone                 = EXCLUDED.phone,
    email                 = EXCLUDED.email,
    website               = EXCLUDED.website,
    nif                   = EXCLUDED.nif,
    patente               = EXCLUDED.patente,
    rc                    = EXCLUDED.rc,
    bank_name             = EXCLUDED.bank_name,
    bank_account          = EXCLUDED.bank_account,
    invoice_prefix        = EXCLUDED.invoice_prefix,
    quote_prefix          = EXCLUDED.quote_prefix,
    delivery_note_prefix  = EXCLUDED.delivery_note_prefix,
    receipt_footer        = EXCLUDED.receipt_footer,
    receipt_header        = EXCLUDED.receipt_header,
    low_stock_threshold   = EXCLUDED.low_stock_threshold
  RETURNING id INTO v_result;

  RETURN jsonb_build_object('id', v_result, 'status', 'saved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auto_parts_business_settings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_business_settings TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260803 applied: auto_parts_business_settings table + RPCs'; END $$;
