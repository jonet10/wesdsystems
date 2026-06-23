-- ============================================================================
-- REPAIR: Link School Admin accounts to the correct school business
-- Correct Business ID: d612bbf1-0246-4cb4-b111-cd40168fd1a3 ("EDSVP")
-- ============================================================================

-- 1. Insert or update the profile row for UID '3ff5e513-7c44-43fb-af06-ad7a3de716df'
INSERT INTO public.profiles (
  id,
  full_name,
  business_name,
  business_type,
  role,
  business_id
)
VALUES (
  '3ff5e513-7c44-43fb-af06-ad7a3de716df',
  'Directeur EDSVP (Account 1)',
  'EDSVP',
  'school',
  'school_admin',
  'd612bbf1-0246-4cb4-b111-cd40168fd1a3'
)
ON CONFLICT (id) DO UPDATE SET
  business_name = 'EDSVP',
  business_type = 'school',
  role = 'school_admin',
  business_id = 'd612bbf1-0246-4cb4-b111-cd40168fd1a3';

-- 2. Insert or update the profile row for UID '8fdde0ff-27ed-41a0-bb58-a06848c5a26d'
-- This matches the active user ID from your browser dev tools log.
INSERT INTO public.profiles (
  id,
  full_name,
  business_name,
  business_type,
  role,
  business_id
)
VALUES (
  '8fdde0ff-27ed-41a0-bb58-a06848c5a26d',
  'Directeur EDSVP (Account 2)',
  'EDSVP',
  'school',
  'school_admin',
  'd612bbf1-0246-4cb4-b111-cd40168fd1a3'
)
ON CONFLICT (id) DO UPDATE SET
  business_name = 'EDSVP',
  business_type = 'school',
  role = 'school_admin',
  business_id = 'd612bbf1-0246-4cb4-b111-cd40168fd1a3';
