-- ────────────────────────────────────────────────────────────────────────────
-- Migration 20260829: School user accounts
-- Adds username, email, is_active to profiles table
-- Enables school admin to create staff accounts (caissiers, comptables, etc.)
-- ────────────────────────────────────────────────────────────────────────────

-- 0. Enable unaccent extension (needed for username normalization)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Add missing columns to profiles table (safe, idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username      TEXT,
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT true;

-- 2. Create unique index on username (case-insensitive) so no two users share same username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 3. Populate email column from auth.users for existing profiles (backfill)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

-- 4. Populate username from full_name for existing school staff (backfill, safe)
-- Creates usernames like "jean.dupont" for existing school role profiles that have no username
UPDATE public.profiles
SET username = lower(
  regexp_replace(
    regexp_replace(
      unaccent(trim(full_name)),
      '[^a-zA-Z0-9\s\-]', '', 'g'
    ),
    '\s+', '.', 'g'
  )
)
WHERE username IS NULL
  AND role IN ('school_cashier', 'school_accountant', 'school_teacher', 'school_admin')
  AND full_name IS NOT NULL;

-- 5. Auto-fill email on new signups via trigger update (profiles inserted by auth trigger)
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If email column is empty, fetch it from auth.users
  IF NEW.email IS NULL THEN
    SELECT email INTO NEW.email
    FROM auth.users
    WHERE id = NEW.id;
  END IF;

  -- If username is provided via metadata, copy it
  IF NEW.username IS NULL THEN
    DECLARE
      v_meta_username TEXT;
    BEGIN
      SELECT raw_user_meta_data->>'username'
      INTO v_meta_username
      FROM auth.users
      WHERE id = NEW.id;

      IF v_meta_username IS NOT NULL AND v_meta_username <> '' THEN
        NEW.username := lower(trim(v_meta_username));
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger on profiles INSERT
DROP TRIGGER IF EXISTS trg_sync_profile_email ON public.profiles;
CREATE TRIGGER trg_sync_profile_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_from_auth();

-- 6. RLS: School admins can read all profiles of their own business
DROP POLICY IF EXISTS "school admin read own business profiles" ON public.profiles;
CREATE POLICY "school admin read own business profiles"
  ON public.profiles
  FOR SELECT
  USING (
    business_id = (
      SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
    AND (
      -- The requesting user is a school_admin of that business
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'school_admin'
      )
      -- OR the user is viewing their own profile
      OR id = auth.uid()
    )
  );

-- 7. School admins can update profiles in their business (for is_active toggle, role changes)
DROP POLICY IF EXISTS "school admin update own business profiles" ON public.profiles;
CREATE POLICY "school admin update own business profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    business_id = (
      SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'school_admin'
    )
  )
  WITH CHECK (
    business_id = (
      SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
  );

-- 8. School admins can upsert profiles for staff they create
DROP POLICY IF EXISTS "school admin upsert staff profiles" ON public.profiles;
CREATE POLICY "school admin upsert staff profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    business_id = (
      SELECT business_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'school_admin'
    )
    AND role IN ('school_cashier', 'school_accountant', 'school_teacher')
  );
