-- ============================================================================
-- Bridge business_branches into legacy salon_branches
-- ============================================================================
-- The salon module currently sends branch IDs from public.business_branches,
-- while several salon_* tables still enforce foreign keys against
-- public.salon_branches.
--
-- To keep the current app flow working without rewriting every table FK, we
-- mirror business_branches rows into salon_branches using the same UUID. That
-- makes the existing branch_id foreign keys valid immediately after signup.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_business_branch_to_salon_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.salon_branches (
    id,
    business_id,
    name,
    phone,
    email,
    address,
    city,
    country,
    currency_code,
    timezone,
    opening_time,
    closing_time,
    is_active,
    metadata,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.business_id,
    NEW.name,
    NEW.phone,
    NEW.email,
    NEW.address,
    NULL,
    'Haiti',
    'HTG',
    'America/Port-au-Prince',
    '09:00:00',
    '18:00:00',
    NEW.active,
    jsonb_build_object(
      'source', 'business_branches',
      'branch_code', NEW.branch_code
    ),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    business_id = EXCLUDED.business_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_branch_to_salon_branch ON public.business_branches;
CREATE TRIGGER trg_sync_business_branch_to_salon_branch
  AFTER INSERT OR UPDATE ON public.business_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_business_branch_to_salon_branch();

DO $$
DECLARE
  v_branch RECORD;
BEGIN
  FOR v_branch IN
    SELECT
      id,
      business_id,
      name,
      phone,
      email,
      address,
      active,
      branch_code,
      created_at,
      updated_at
    FROM public.business_branches
  LOOP
    INSERT INTO public.salon_branches (
      id,
      business_id,
      name,
      phone,
      email,
      address,
      city,
      country,
      currency_code,
      timezone,
      opening_time,
      closing_time,
      is_active,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      v_branch.id,
      v_branch.business_id,
      v_branch.name,
      v_branch.phone,
      v_branch.email,
      v_branch.address,
      NULL,
      'Haiti',
      'HTG',
      'America/Port-au-Prince',
      '09:00:00',
      '18:00:00',
      v_branch.active,
      jsonb_build_object(
        'source', 'business_branches',
        'branch_code', v_branch.branch_code
      ),
      v_branch.created_at,
      v_branch.updated_at
    )
    ON CONFLICT (id) DO UPDATE
    SET
      business_id = EXCLUDED.business_id,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$;

