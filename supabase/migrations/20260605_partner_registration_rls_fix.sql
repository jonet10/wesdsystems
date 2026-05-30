-- ============================================================================
-- WESD SYSTEMS: PARTNER REGISTRATION RLS FIX
-- Secure partner application insert flow with French payload support.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partners'
      AND column_name = 'status'
  ) THEN
    UPDATE public.partners
    SET status = 'approved'
    WHERE status = 'active';

    ALTER TABLE public.partners
      DROP CONSTRAINT IF EXISTS partners_status_check;

    ALTER TABLE public.partners
      ADD CONSTRAINT partners_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.submit_partner_application(p_payload JSONB)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing public.partners;
  v_code TEXT;
  v_full_name TEXT := btrim(coalesce(p_payload->>'nom_complet', p_payload->>'full_name', ''));
  v_email TEXT := nullif(btrim(coalesce(p_payload->>'email', '')), '');
  v_phone TEXT := nullif(btrim(coalesce(p_payload->>'telephone', p_payload->>'phone', '')), '');
  v_whatsapp TEXT := nullif(btrim(coalesce(p_payload->>'whatsapp', p_payload->>'whatsapp_number', '')), '');
  v_city TEXT := nullif(btrim(coalesce(p_payload->>'ville', p_payload->>'city', '')), '');
  v_department TEXT := nullif(btrim(coalesce(p_payload->>'departement', p_payload->>'department', '')), '');
  v_partner_type TEXT := nullif(btrim(coalesce(p_payload->>'type_partenaire', p_payload->>'partner_type', '')), '');
  v_facebook TEXT := nullif(btrim(coalesce(p_payload->>'facebook', p_payload->>'facebook_url', '')), '');
  v_instagram TEXT := nullif(btrim(coalesce(p_payload->>'instagram', p_payload->>'instagram_url', '')), '');
  v_tiktok TEXT := nullif(btrim(coalesce(p_payload->>'tiktok', p_payload->>'tiktok_url', '')), '');
  v_youtube TEXT := nullif(btrim(coalesce(p_payload->>'youtube', p_payload->>'youtube_url', '')), '');
  v_website TEXT := nullif(btrim(coalesce(p_payload->>'site_web', p_payload->>'website_url', '')), '');
  v_moncash TEXT := nullif(btrim(coalesce(p_payload->>'moncash', p_payload->>'moncash_number', '')), '');
  v_natcash TEXT := nullif(btrim(coalesce(p_payload->>'natcash', p_payload->>'natcash_number', '')), '');
  v_bank_account JSONB := coalesce(p_payload->'compte_bancaire', p_payload->'bank_account', '{}'::jsonb);
  v_notes TEXT := nullif(btrim(coalesce(p_payload->>'notes', '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING MESSAGE = 'Vous devez être connecté pour soumettre une demande de partenariat.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.partners p
    WHERE p.user_id = v_user_id
      AND p.status IN ('pending', 'approved', 'suspended')
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PARTNER_APPLICATION' USING MESSAGE = 'Vous avez déjà une demande de partenariat en cours.';
  END IF;

  IF v_full_name = '' OR v_email IS NULL OR v_phone IS NULL OR v_city IS NULL OR v_department IS NULL OR v_partner_type IS NULL THEN
    RAISE EXCEPTION 'INVALID_PARTNER_APPLICATION' USING MESSAGE = 'Certains champs obligatoires sont manquants.';
  END IF;

  v_code := public.generate_partner_code(v_full_name);

  INSERT INTO public.partners (
    user_id,
    display_name,
    full_name,
    email,
    phone,
    whatsapp_number,
    city,
    department,
    partner_type,
    facebook_url,
    instagram_url,
    tiktok_url,
    youtube_url,
    website_url,
    moncash_number,
    natcash_number,
    bank_account,
    notes,
    status,
    partner_level,
    referral_code,
    referral_url,
    application_source
  )
  VALUES (
    v_user_id,
    v_full_name,
    v_full_name,
    v_email,
    v_phone,
    v_whatsapp,
    v_city,
    v_department,
    v_partner_type,
    v_facebook,
    v_instagram,
    v_tiktok,
    v_youtube,
    v_website,
    v_moncash,
    v_natcash,
    v_bank_account,
    v_notes,
    'pending',
    'affiliate',
    v_code,
    NULL,
    'partner_registration'
  )
  RETURNING * INTO v_existing;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_partner_application(JSONB) TO authenticated;

