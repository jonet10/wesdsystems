-- ============================================================================
-- Public community activity feed bootstrap
-- Single-file, idempotent setup for the public landing activity stream.
-- This supersedes the older 20260619, 20260620 and 20260622 feed migrations.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (
    type IN (
      'partner_joined',
      'business_joined',
      'pharmacy_joined',
      'restaurant_joined',
      'market_joined',
      'boutique_joined',
      'service_published',
      'reservation_created',
      'bar_product_added',
      'bar_cocktail_created',
      'bar_sale_created'
    )
  ),
  message TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_public BOOLEAN NOT NULL DEFAULT true,
  source_type TEXT,
  source_id UUID
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_public_created_at
  ON public.activity_feed (is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_type_created_at
  ON public.activity_feed (type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_feed_source_identity
  ON public.activity_feed (source_type, source_id);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;

ALTER TABLE public.activity_feed DROP CONSTRAINT IF EXISTS activity_feed_type_check;
ALTER TABLE public.activity_feed ADD CONSTRAINT activity_feed_type_check CHECK (
  type IN (
    'partner_joined',
    'business_joined',
    'pharmacy_joined',
    'restaurant_joined',
    'market_joined',
    'boutique_joined',
    'service_published',
    'reservation_created',
    'bar_product_added',
    'bar_cocktail_created',
    'bar_sale_created'
  )
);

DROP POLICY IF EXISTS activity_feed_public_select ON public.activity_feed;
CREATE POLICY activity_feed_public_select ON public.activity_feed
  FOR SELECT
  USING (is_public = true);

GRANT SELECT ON public.activity_feed TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_public_activity_feed(
  p_type TEXT,
  p_message TEXT,
  p_city TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT now(),
  p_is_public BOOLEAN DEFAULT true,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.activity_feed (
    type,
    message,
    city,
    created_at,
    is_public,
    source_type,
    source_id
  )
  VALUES (
    p_type,
    p_message,
    NULLIF(BTRIM(COALESCE(p_city, '')), ''),
    COALESCE(p_created_at, now()),
    COALESCE(p_is_public, true),
    NULLIF(BTRIM(COALESCE(p_source_type, '')), ''),
    p_source_id
  )
  ON CONFLICT (source_type, source_id)
  DO UPDATE SET
    type = EXCLUDED.type,
    message = EXCLUDED.message,
    city = EXCLUDED.city,
    created_at = EXCLUDED.created_at,
    is_public = EXCLUDED.is_public
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_branch_business_name(p_branch_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_name
  FROM (
    SELECT b.name AS business_name
    FROM public.business_branches bb
    JOIN public.businesses b ON b.id = bb.business_id
    WHERE bb.id = p_branch_id
    UNION ALL
    SELECT b.name AS business_name
    FROM public.salon_branches sb
    JOIN public.businesses b ON b.id = sb.business_id
    WHERE sb.id = p_branch_id
  ) branch_business
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_community_stats()
RETURNS TABLE (
  business_count BIGINT,
  partner_count BIGINT,
  user_count BIGINT,
  reservation_count BIGINT,
  service_count BIGINT,
  public_event_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.businesses) AS business_count,
    (SELECT COUNT(*)::BIGINT FROM public.partners WHERE status IN ('approved', 'active')) AS partner_count,
    (SELECT COUNT(*)::BIGINT FROM public.profiles) AS user_count,
    (SELECT COUNT(*)::BIGINT FROM public.salon_appointments) AS reservation_count,
    (SELECT COUNT(*)::BIGINT FROM public.salon_services WHERE COALESCE(is_active, true)) AS service_count,
    (SELECT COUNT(*)::BIGINT FROM public.activity_feed WHERE is_public = true) AS public_event_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_community_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_business_module_info(p_business_id UUID)
RETURNS TABLE(activity_type TEXT, module_label TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE business_type
      WHEN 'pharmacy' THEN 'pharmacy_joined'
      WHEN 'restaurant' THEN 'restaurant_joined'
      WHEN 'bar' THEN 'restaurant_joined'
      WHEN 'market' THEN 'market_joined'
      WHEN 'boutique' THEN 'boutique_joined'
      ELSE 'business_joined'
    END AS activity_type,
    CASE business_type
      WHEN 'pharmacy' THEN 'Pharmacie'
      WHEN 'restaurant' THEN 'Bar & resto'
      WHEN 'bar' THEN 'Bar & resto'
      WHEN 'market' THEN 'Market'
      WHEN 'boutique' THEN 'Boutique'
      ELSE 'Établissement'
    END AS module_label
  FROM (
    SELECT COALESCE(
      lower(NULLIF(BTRIM(COALESCE(u.raw_user_meta_data->>'business_type', '')), '')),
      ''
    ) AS business_type
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.business_id = p_business_id
    ORDER BY p.id ASC
    LIMIT 1
  ) profile_meta;
$$;

-- ---------------------------------------------------------------------------
-- Activity triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_partner_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city TEXT := NULLIF(BTRIM(COALESCE(NEW.city, '')), '');
  v_name TEXT := NULLIF(BTRIM(COALESCE(NEW.full_name, NEW.display_name, '')), '');
  v_message TEXT;
BEGIN
  IF NEW.status IN ('approved', 'active')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') NOT IN ('approved', 'active')) THEN
    v_message := CASE
      WHEN v_city IS NOT NULL THEN
        format('%s depuis %s vient de rejoindre notre réseau de partenaires', COALESCE(v_name, 'Un nouveau partenaire'), v_city)
      ELSE
        format('%s vient de rejoindre notre réseau de partenaires', COALESCE(v_name, 'Un nouveau partenaire'))
    END;

    PERFORM public.log_public_activity_feed(
      'partner_joined',
      v_message,
      COALESCE(v_city, 'Haïti'),
      COALESCE(NEW.approved_at, NEW.updated_at, NEW.created_at, now()),
      true,
      'partner',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_business_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_info RECORD;
  v_business_name TEXT := COALESCE(NULLIF(BTRIM(COALESCE(NEW.name, '')), ''), 'Un établissement');
BEGIN
  SELECT activity_type, module_label
    INTO v_info
  FROM public.resolve_business_module_info(NEW.id);

  PERFORM public.log_public_activity_feed(
    COALESCE(v_info.activity_type, 'business_joined'),
    format(
      '%s a rejoint la plateforme en tant que %s',
      v_business_name,
      COALESCE(v_info.module_label, 'Établissement')
    ),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'business',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_profile_business_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_business_created_at TIMESTAMPTZ;
  v_info RECORD;
BEGIN
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(BTRIM(COALESCE(b.name, '')), ''), 'Un établissement'),
    COALESCE(b.created_at, now())
  INTO v_business_name, v_business_created_at
  FROM public.businesses b
  WHERE b.id = NEW.business_id;

  SELECT activity_type, module_label
    INTO v_info
  FROM public.resolve_business_module_info(NEW.business_id);

  PERFORM public.log_public_activity_feed(
    COALESCE(v_info.activity_type, 'business_joined'),
    format(
      '%s a rejoint la plateforme en tant que %s',
      COALESCE(v_business_name, 'Un établissement'),
      COALESCE(v_info.module_label, 'Établissement')
    ),
    'Haïti',
    COALESCE(v_business_created_at, now()),
    true,
    'business',
    NEW.business_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_service_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
BEGIN
  v_business_name := public.resolve_branch_business_name(NEW.branch_id);

  PERFORM public.log_public_activity_feed(
    'service_published',
    format('%s vient d''ajouter un nouveau service', COALESCE(v_business_name, 'Un établissement')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'salon_service',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_reservation_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
BEGIN
  v_business_name := public.resolve_branch_business_name(NEW.branch_id);

  PERFORM public.log_public_activity_feed(
    'reservation_created',
    format('Nouvelle réservation enregistrée chez %s', COALESCE(v_business_name, 'un établissement')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'salon_appointment',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_bar_product_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
BEGIN
  v_business_name := public.resolve_branch_business_name(NEW.branch_id);

  PERFORM public.log_public_activity_feed(
    'bar_product_added',
    format('%s vient d''ajouter un produit bar: %s', COALESCE(v_business_name, 'Un établissement'), COALESCE(NULLIF(BTRIM(NEW.name), ''), 'Produit bar')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'bar_product',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_bar_cocktail_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
BEGIN
  v_business_name := public.resolve_branch_business_name(NEW.branch_id);

  PERFORM public.log_public_activity_feed(
    'bar_cocktail_created',
    format('%s vient de créer le cocktail %s', COALESCE(v_business_name, 'Un établissement'), COALESCE(NULLIF(BTRIM(NEW.name), ''), 'sans nom')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'bar_cocktail',
    NEW.id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_bar_sale_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
BEGIN
  v_business_name := public.resolve_branch_business_name(NEW.branch_id);

  PERFORM public.log_public_activity_feed(
    'bar_sale_created',
    format('Nouvelle vente bar enregistrée chez %s', COALESCE(v_business_name, 'un établissement')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true,
    'bar_sale',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_feed_partner ON public.partners;
CREATE TRIGGER trg_activity_feed_partner
  AFTER INSERT OR UPDATE OF status, partner_level, display_name, full_name, city
  ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_partner_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_business ON public.businesses;
CREATE TRIGGER trg_activity_feed_business
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_business_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_profile_business ON public.profiles;
CREATE TRIGGER trg_activity_feed_profile_business
  AFTER INSERT OR UPDATE OF business_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_business_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_service ON public.salon_services;
CREATE TRIGGER trg_activity_feed_service
  AFTER INSERT ON public.salon_services
  FOR EACH ROW
  EXECUTE FUNCTION public.log_service_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_reservation ON public.salon_appointments;
CREATE TRIGGER trg_activity_feed_reservation
  AFTER INSERT ON public.salon_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_reservation_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_bar_product ON public.bar_products;
CREATE TRIGGER trg_activity_feed_bar_product
  AFTER INSERT ON public.bar_products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_bar_product_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_bar_cocktail ON public.bar_cocktails;
CREATE TRIGGER trg_activity_feed_bar_cocktail
  AFTER INSERT ON public.bar_cocktails
  FOR EACH ROW
  EXECUTE FUNCTION public.log_bar_cocktail_activity_feed();

DROP TRIGGER IF EXISTS trg_activity_feed_bar_sale ON public.bar_sales;
CREATE TRIGGER trg_activity_feed_bar_sale
  AFTER INSERT ON public.bar_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.log_bar_sale_activity_feed();

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'partner_joined',
  CASE
    WHEN NULLIF(BTRIM(COALESCE(p.city, '')), '') IS NOT NULL THEN
      format(
        '%s depuis %s vient de rejoindre notre réseau de partenaires',
        COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, p.display_name, '')), ''), 'Un nouveau partenaire'),
        NULLIF(BTRIM(COALESCE(p.city, '')), '')
      )
    ELSE
      format(
        '%s vient de rejoindre notre réseau de partenaires',
        COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, p.display_name, '')), ''), 'Un nouveau partenaire')
      )
  END,
  NULLIF(BTRIM(COALESCE(p.city, '')), ''),
  COALESCE(p.approved_at, p.updated_at, p.created_at, now()),
  true,
  'partner',
  p.id
FROM public.partners p
WHERE p.status IN ('approved', 'active')
ON CONFLICT (source_type, source_id) DO NOTHING;

WITH resolved_businesses AS (
  SELECT
    b.id AS business_id,
    COALESCE(NULLIF(BTRIM(COALESCE(b.name, '')), ''), 'Un établissement') AS business_name,
    COALESCE(b.created_at, now()) AS created_at,
    info.activity_type,
    info.module_label
  FROM public.businesses b
  LEFT JOIN LATERAL public.resolve_business_module_info(b.id) info ON true
)
INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  COALESCE(activity_type, 'business_joined'),
  format(
    '%s a rejoint la plateforme en tant que %s',
    business_name,
    COALESCE(module_label, 'Établissement')
  ),
  'Haïti',
  created_at,
  true,
  'business',
  business_id
FROM resolved_businesses
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'service_published',
  format('%s vient d''ajouter un nouveau service', COALESCE(public.resolve_branch_business_name(s.branch_id), 'Un établissement')),
  'Haïti',
  COALESCE(s.created_at, now()),
  true,
  'salon_service',
  s.id
FROM public.salon_services s
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'reservation_created',
  format('Nouvelle réservation enregistrée chez %s', COALESCE(public.resolve_branch_business_name(a.branch_id), 'un établissement')),
  'Haïti',
  COALESCE(a.created_at, now()),
  true,
  'salon_appointment',
  a.id
FROM public.salon_appointments a
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'bar_product_added',
  format('%s vient d''ajouter un produit bar: %s', COALESCE(public.resolve_branch_business_name(p.branch_id), 'Un établissement'), COALESCE(NULLIF(BTRIM(COALESCE(p.name, '')), ''), 'Produit bar')),
  'Haïti',
  COALESCE(p.created_at, now()),
  true,
  'bar_product',
  p.id
FROM public.bar_products p
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'bar_cocktail_created',
  format('%s vient de créer le cocktail %s', COALESCE(public.resolve_branch_business_name(c.branch_id), 'Un établissement'), COALESCE(NULLIF(BTRIM(COALESCE(c.name, '')), ''), 'sans nom')),
  'Haïti',
  COALESCE(c.created_at, now()),
  true,
  'bar_cocktail',
  c.id
FROM public.bar_cocktails c
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.activity_feed (
  type,
  message,
  city,
  created_at,
  is_public,
  source_type,
  source_id
)
SELECT
  'bar_sale_created',
  format('Nouvelle vente bar enregistrée chez %s', COALESCE(public.resolve_branch_business_name(s.branch_id), 'un établissement')),
  'Haïti',
  COALESCE(s.created_at, now()),
  true,
  'bar_sale',
  s.id
FROM public.bar_sales s
ON CONFLICT (source_type, source_id) DO NOTHING;

