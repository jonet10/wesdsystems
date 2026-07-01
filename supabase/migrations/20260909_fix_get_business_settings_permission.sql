-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260909: Allow cashiers to read business settings for printing
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_auto_parts_business_settings(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Permettre l'accès aux administrateurs (products.manage) ainsi qu'aux caissiers (pos.sell, products.read)
  IF NOT (
    public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) OR
    public.auto_parts_has_permission(p_session_token, 'pos.sell', p_business_id) OR
    public.auto_parts_has_permission(p_session_token, 'products.read', p_business_id)
  ) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  SELECT jsonb_build_object(
    'id', bs.id,
    'business_id', bs.business_id,
    'company_name', bs.company_name,
    'logo_url', bs.logo_url,
    'slogan', bs.slogan,
    'whatsapp', bs.whatsapp,
    'address', bs.address,
    'phone', bs.phone,
    'email', bs.email,
    'website', bs.website,
    'nif', bs.nif,
    'patente', bs.patente,
    'rc', bs.rc,
    'bank_name', bs.bank_name,
    'bank_account', bs.bank_account,
    'invoice_prefix', bs.invoice_prefix,
    'quote_prefix', bs.quote_prefix,
    'delivery_note_prefix', bs.delivery_note_prefix,
    'receipt_footer', bs.receipt_footer,
    'receipt_header', bs.receipt_header,
    'low_stock_threshold', bs.low_stock_threshold,
    'created_at', bs.created_at,
    'updated_at', bs.updated_at
  ) INTO v_result
  FROM public.auto_parts_business_settings bs
  WHERE bs.business_id = p_business_id;

  IF NOT FOUND THEN
    RETURN '{}'::JSONB;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auto_parts_business_settings(UUID, TEXT) TO anon, authenticated;
