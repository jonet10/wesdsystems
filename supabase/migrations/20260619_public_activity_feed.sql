-- ============================================================================
-- Public community activity feed
-- ============================================================================
-- Creates a public, realtime-friendly activity stream for the landing page.
-- Only public activities are readable; triggers write entries for approved
-- partners, salons, services, and reservations.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (
    type IN (
      'partner_joined',
      'ambassador_joined',
      'salon_joined',
      'service_published',
      'reservation_created'
    )
  ),
  message TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_public BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_public_created_at
  ON public.activity_feed (is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_type_created_at
  ON public.activity_feed (type, created_at DESC);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

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
  p_is_public BOOLEAN DEFAULT true
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
    is_public
  )
  VALUES (
    p_type,
    p_message,
    NULLIF(BTRIM(COALESCE(p_city, '')), ''),
    COALESCE(p_created_at, now()),
    COALESCE(p_is_public, true)
  )
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
  salon_count BIGINT,
  partner_count BIGINT,
  ambassador_count BIGINT,
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
    (SELECT COUNT(*)::BIGINT FROM public.businesses) AS salon_count,
    (SELECT COUNT(*)::BIGINT FROM public.partners WHERE status IN ('approved', 'active')) AS partner_count,
    (SELECT COUNT(*)::BIGINT FROM public.partners WHERE status IN ('approved', 'active') AND partner_level = 'affiliate') AS ambassador_count,
    (SELECT COUNT(*)::BIGINT FROM public.profiles) AS user_count,
    (SELECT COUNT(*)::BIGINT FROM public.salon_appointments) AS reservation_count,
    (SELECT COUNT(*)::BIGINT FROM public.salon_services WHERE COALESCE(is_active, true)) AS service_count,
    (SELECT COUNT(*)::BIGINT FROM public.activity_feed WHERE is_public = true) AS public_event_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_community_stats() TO anon, authenticated;

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
  v_type TEXT;
  v_message TEXT;
BEGIN
  IF NEW.status IN ('approved', 'active')
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') NOT IN ('approved', 'active')) THEN
    IF NEW.partner_level = 'affiliate' THEN
      v_type := 'ambassador_joined';
      v_message := CASE
        WHEN v_city IS NOT NULL THEN
          format('%s depuis %s est devenu(e) Ambassadeur/Ambassadrice', COALESCE(v_name, 'Un nouveau partenaire'), v_city)
        ELSE
          format('%s est devenu(e) Ambassadeur/Ambassadrice', COALESCE(v_name, 'Un nouveau partenaire'))
      END;
    ELSE
      v_type := 'partner_joined';
      v_message := CASE
        WHEN v_city IS NOT NULL THEN
          format('%s depuis %s vient de rejoindre notre réseau de partenaires', COALESCE(v_name, 'Un nouveau partenaire'), v_city)
        ELSE
          format('%s vient de rejoindre notre réseau de partenaires', COALESCE(v_name, 'Un nouveau partenaire'))
      END;
    END IF;

    PERFORM public.log_public_activity_feed(
      v_type,
      v_message,
      COALESCE(v_city, 'Haïti'),
      COALESCE(NEW.approved_at, NEW.updated_at, NEW.created_at, now()),
      true
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
  v_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_message := format('%s a rejoint la plateforme', COALESCE(NULLIF(BTRIM(NEW.name), ''), 'Un nouveau salon'));

    PERFORM public.log_public_activity_feed(
      'salon_joined',
      v_message,
      'Haïti',
      COALESCE(NEW.created_at, now()),
      true
    );
  END IF;

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
    format('%s vient d''ajouter un nouveau service', COALESCE(v_business_name, 'Un salon')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true
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
    format('Nouvelle réservation enregistrée chez %s', COALESCE(v_business_name, 'un salon')),
    'Haïti',
    COALESCE(NEW.created_at, now()),
    true
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

-- ---------------------------------------------------------------------------
-- Backfill latest public activities for the landing page
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_feed) THEN
    INSERT INTO public.activity_feed (type, message, city, created_at, is_public)
    WITH seeded AS (
      SELECT
        'partner_joined'::text AS type,
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
        END AS message,
        NULLIF(BTRIM(COALESCE(p.city, '')), '') AS city,
        COALESCE(p.approved_at, p.updated_at, p.created_at, now()) AS created_at,
        true AS is_public
      FROM public.partners p
      WHERE p.status IN ('approved', 'active')
        AND p.partner_level <> 'affiliate'

      UNION ALL

      SELECT
        CASE WHEN COALESCE(p.partner_level, 'affiliate') = 'affiliate' THEN 'ambassador_joined' ELSE 'partner_joined' END AS type,
        CASE
          WHEN NULLIF(BTRIM(COALESCE(p.city, '')), '') IS NOT NULL THEN
            format(
              '%s depuis %s est devenu(e) Ambassadeur/Ambassadrice',
              COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, p.display_name, '')), ''), 'Un nouveau partenaire'),
              NULLIF(BTRIM(COALESCE(p.city, '')), '')
            )
          ELSE
            format(
              '%s est devenu(e) Ambassadeur/Ambassadrice',
              COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, p.display_name, '')), ''), 'Un nouveau partenaire')
            )
        END AS message,
        NULLIF(BTRIM(COALESCE(p.city, '')), '') AS city,
        COALESCE(p.approved_at, p.updated_at, p.created_at, now()) AS created_at,
        true AS is_public
      FROM public.partners p
      WHERE p.status IN ('approved', 'active')
        AND p.partner_level = 'affiliate'

      UNION ALL

      SELECT
        'salon_joined'::text AS type,
        format('%s a rejoint la plateforme', COALESCE(NULLIF(BTRIM(COALESCE(b.name, '')), ''), 'Un nouveau salon')) AS message,
        'Haïti'::text AS city,
        COALESCE(b.created_at, now()) AS created_at,
        true AS is_public
      FROM public.businesses b

      UNION ALL

      SELECT
        'service_published'::text AS type,
        format('%s vient d''ajouter un nouveau service', COALESCE(public.resolve_branch_business_name(s.branch_id), 'Un salon')) AS message,
        'Haïti'::text AS city,
        COALESCE(s.created_at, now()) AS created_at,
        true AS is_public
      FROM public.salon_services s

      UNION ALL

      SELECT
        'reservation_created'::text AS type,
        format('Nouvelle réservation enregistrée chez %s', COALESCE(public.resolve_branch_business_name(a.branch_id), 'un salon')) AS message,
        'Haïti'::text AS city,
        COALESCE(a.created_at, now()) AS created_at,
        true AS is_public
      FROM public.salon_appointments a
    )
    SELECT type, message, city, created_at, is_public
    FROM seeded
    ORDER BY created_at DESC
    LIMIT 30;
  END IF;
END;
$$;
