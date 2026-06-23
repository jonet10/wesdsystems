-- ────────────────────────────────────────────────────────────────────────────
-- Migration 20260826: Fix business deletion RLS policy, profile foreign keys,
-- and business_branches RLS policy recursion.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Add DELETE RLS policy on public.businesses for super_admin
-- This allows Super Admins to delete establishments from the admin panel.
DROP POLICY IF EXISTS "businesses super_admin delete" ON public.businesses;
CREATE POLICY "businesses super_admin delete" ON public.businesses
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND public.current_user_role() = 'super_admin'
  );

-- 2. Dynamically update profiles table foreign keys referencing businesses(id) to ON DELETE SET NULL.
-- This ensures that deleting a business does not trigger foreign key constraint errors
-- when profiles are linked to the business. Instead, the profiles' business reference
-- will be set to NULL, keeping the user profiles intact but unlinked.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            tc.constraint_name,
            kcu.column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
            AND tc.table_name = 'profiles'
            AND ccu.table_schema = 'public'
            AND ccu.table_name = 'businesses'
            AND ccu.column_name = 'id'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
        EXECUTE format('ALTER TABLE public.profiles ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.businesses(id) ON DELETE SET NULL', r.constraint_name, r.column_name);
    END LOOP;
END;
$$;

-- 3. Fix RLS recursion and insertion policy on public.business_branches
-- The previous policies queried public.profiles directly which could cause recursion
-- or fail if profiles table was under RLS query constraints during trigger/transaction.
-- We use the SECURITY DEFINER functions current_user_role() and current_user_business_id() instead.
DROP POLICY IF EXISTS "business branches read" ON public.business_branches;
CREATE POLICY "business branches read" ON public.business_branches
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR business_id = public.current_user_business_id()
    )
  );

DROP POLICY IF EXISTS "business branches manage" ON public.business_branches;
CREATE POLICY "business branches manage" ON public.business_branches
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND (
      public.current_user_role() = 'super_admin'
      OR business_id = public.current_user_business_id()
    )
  );

-- 4. Clean up any existing orphaned business references in public.profiles.
-- This repairs existing profiles that were linked to businesses that were deleted
-- before the ON DELETE SET NULL constraint was added.
UPDATE public.profiles
SET business_id = NULL
WHERE business_id IS NOT NULL 
  AND business_id NOT IN (SELECT id FROM public.businesses);

-- Re-link super admins to the main super admin business if their business reference is orphaned.
UPDATE public.profiles
SET business_id = 'b8a9a11e-cf63-41bf-b289-a5f324ea5596'
WHERE role = 'super_admin'
  AND (business_id IS NULL OR business_id NOT IN (SELECT id FROM public.businesses))
  AND EXISTS (SELECT 1 FROM public.businesses WHERE id = 'b8a9a11e-cf63-41bf-b289-a5f324ea5596');
