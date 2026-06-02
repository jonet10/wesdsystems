-- ============================================================================
-- Auto-create a default branch for each business
-- ============================================================================
-- This fixes the "Aucune branche sélectionnée" case for brand-new salons.
-- Every business must have at least one branch so salon_scoped tables can be
-- created with a valid branch_id immediately after signup.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_default_business_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT bb.id
    INTO v_branch_id
  FROM public.business_branches bb
  WHERE bb.business_id = NEW.id
  ORDER BY bb.created_at ASC, bb.id ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO public.business_branches (
      business_id,
      name,
      active
    )
    VALUES (
      NEW.id,
      'Branche principale',
      true
    )
    RETURNING id INTO v_branch_id;
  END IF;

  IF NEW.active_branch_id IS NULL OR NEW.active_branch_id <> v_branch_id THEN
    UPDATE public.businesses
    SET active_branch_id = v_branch_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_business_branch ON public.businesses;
CREATE TRIGGER trg_create_default_business_branch
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_business_branch();

DO $$
DECLARE
  v_business RECORD;
  v_branch_id UUID;
BEGIN
  FOR v_business IN
    SELECT b.id
    FROM public.businesses b
    LEFT JOIN public.business_branches bb ON bb.business_id = b.id
    WHERE bb.id IS NULL
  LOOP
    INSERT INTO public.business_branches (
      business_id,
      name,
      active
    )
    VALUES (
      v_business.id,
      'Branche principale',
      true
    )
    RETURNING id INTO v_branch_id;

    UPDATE public.businesses
    SET active_branch_id = v_branch_id
    WHERE id = v_business.id;
  END LOOP;

  WITH first_branch AS (
    SELECT DISTINCT ON (business_id)
      business_id,
      id AS branch_id
    FROM public.business_branches
    ORDER BY business_id, created_at ASC, id ASC
  )
  UPDATE public.businesses b
  SET active_branch_id = fb.branch_id
  FROM first_branch fb
  WHERE b.id = fb.business_id
    AND b.active_branch_id IS NULL;
END;
$$;
