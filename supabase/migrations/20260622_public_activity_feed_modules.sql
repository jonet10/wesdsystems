-- ============================================================================
-- Public community activity feed v3
-- Adds module-specific business activity types for pharmacy, restaurant, market
-- and boutique, while keeping a generic fallback for unknown establishment types.
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

CREATE OR REPLACE FUNCTION public.log_business_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT := COALESCE(NULLIF(BTRIM(COALESCE(NEW.name, '')), ''), 'Un établissement');
  v_info RECORD;
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

DROP TRIGGER IF EXISTS trg_activity_feed_profile_business ON public.profiles;
CREATE TRIGGER trg_activity_feed_profile_business
  AFTER INSERT OR UPDATE OF business_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_business_activity_feed();

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

UPDATE public.activity_feed af
SET
  type = COALESCE(rb.activity_type, 'business_joined'),
  message = format(
    '%s a rejoint la plateforme en tant que %s',
    rb.business_name,
    COALESCE(rb.module_label, 'Établissement')
  ),
  created_at = rb.created_at
FROM (
  SELECT
    b.id AS business_id,
    COALESCE(NULLIF(BTRIM(COALESCE(b.name, '')), ''), 'Un établissement') AS business_name,
    COALESCE(b.created_at, now()) AS created_at,
    info.activity_type,
    info.module_label
  FROM public.businesses b
  LEFT JOIN LATERAL public.resolve_business_module_info(b.id) info ON true
) rb
WHERE af.source_type = 'business'
  AND af.source_id = rb.business_id;
