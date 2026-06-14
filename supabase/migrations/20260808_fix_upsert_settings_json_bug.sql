-- Fix 'invalid input syntax for type json' when returning UUID into JSONB variable

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
  p_low_stock_threshold INTEGER DEFAULT 5,
  p_session_token TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
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
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'saved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_business_settings(
  p_business_id UUID, p_company_name TEXT, p_logo_url TEXT,
  p_slogan TEXT, p_whatsapp TEXT, p_address TEXT, p_phone TEXT,
  p_email TEXT, p_website TEXT, p_nif TEXT, p_patente TEXT, p_rc TEXT,
  p_bank_name TEXT, p_bank_account TEXT, p_invoice_prefix TEXT,
  p_quote_prefix TEXT, p_delivery_note_prefix TEXT, p_receipt_footer TEXT,
  p_receipt_header TEXT, p_low_stock_threshold INTEGER, p_session_token TEXT
) TO anon, authenticated;
