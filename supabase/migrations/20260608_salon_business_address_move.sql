-- ============================================================================
-- Move salon address storage off public.businesses when the live schema does not
-- expose the address column yet.
-- ============================================================================

ALTER TABLE public.salon_business_profiles
  ADD COLUMN IF NOT EXISTS address TEXT;

CREATE INDEX IF NOT EXISTS idx_salon_business_profiles_address
  ON public.salon_business_profiles(address);
