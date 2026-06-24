-- ============================================================================
-- Migration: Auto-generate student matricule (sequential per school)
-- Date: 20260827
-- ============================================================================

-- 1. Create a per-business sequence table to track the last matricule number
CREATE TABLE IF NOT EXISTS public.school_matricule_seq (
  business_id  UUID    PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_value   BIGINT  NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.school_matricule_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own matricule seq"
  ON public.school_matricule_seq
  USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));

-- 2. RPC function: generate the next matricule for a given school business
-- Format: {YEAR}-{PADDED_SEQUENCE}  e.g. "2026-000001"
CREATE OR REPLACE FUNCTION public.generate_school_matricule(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_val BIGINT;
  v_year     TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Upsert: insert if missing, then increment atomically
  INSERT INTO public.school_matricule_seq (business_id, last_value)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id)
  DO UPDATE SET last_value = school_matricule_seq.last_value + 1
  RETURNING last_value INTO v_next_val;

  RETURN v_year || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_school_matricule(UUID) TO authenticated;
