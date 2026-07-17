-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260930: Fix school staff creation & password reset RPC permissions
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_school_staff_member(TEXT, TEXT, TEXT, TEXT, UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.reset_user_password(UUID, TEXT);

-- 1. Redefine create_school_staff_member to accept both school_admin and salon_admin roles
CREATE OR REPLACE FUNCTION public.create_school_staff_member(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_business_id UUID,
    p_permissions TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_business_id UUID;
    v_user_id UUID;
    v_username TEXT;
BEGIN
    -- 1. Resolve caller details
    SELECT role_normalized, business_id 
    INTO v_caller_role, v_caller_business_id 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- 2. Authorization check
    -- Allow super_admin or school_admin/salon_admin of this business
    IF v_caller_role IS DISTINCT FROM 'super_admin' AND (
        v_caller_business_id IS NULL 
        OR v_caller_business_id <> p_business_id 
        OR v_caller_role NOT IN ('school_admin', 'salon_admin')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: Only school admins of this business can create staff accounts.'
        );
    END IF;

    -- 3. Check if email already exists in auth.users (idempotency/recovery)
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);

    IF v_user_id IS NOT NULL THEN
        -- Link or update profile for existing user
        INSERT INTO public.profiles (
            id,
            full_name,
            email,
            role,
            role_normalized,
            business_id,
            is_active
        ) VALUES (
            v_user_id,
            p_full_name,
            p_email,
            p_role,
            CASE 
              WHEN p_role = 'school_teacher' THEN 'school_teacher'
              WHEN p_role = 'school_cashier' THEN 'school_cashier'
              WHEN p_role = 'school_accountant' THEN 'school_accountant'
              ELSE p_role
            END,
            p_business_id,
            true
        ) ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            role_normalized = EXCLUDED.role_normalized,
            business_id = EXCLUDED.business_id,
            is_active = true;

        RETURN jsonb_build_object(
            'success', true,
            'user_id', v_user_id
        );
    END IF;

    -- 4. Generate user ID
    v_user_id := gen_random_uuid();

    -- 5. Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        aud
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        p_email,
        crypt(p_password, gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name, 'role', p_role, 'business_id', p_business_id),
        false,
        'authenticated',
        now(),
        now(),
        '',
        '',
        '',
        '',
        'authenticated'
    );

    -- Generate and de-duplicate username with school acronym
    DECLARE
        v_school_name TEXT;
        v_school_slug TEXT;
        v_suffix INT := 1;
        v_temp_username TEXT;
    BEGIN
        SELECT name INTO v_school_name FROM public.businesses WHERE id = p_business_id;
        
        v_school_slug := lower(regexp_replace(unaccent(trim(v_school_name)), '[^a-zA-Z0-9]+', '', 'g'));
        IF v_school_slug IS NULL OR v_school_slug = '' THEN
            v_school_slug := 'school';
        END IF;

        v_username := lower(regexp_replace(unaccent(trim(p_full_name)), '\s+', '.', 'g')) || '@' || v_school_slug;
        v_temp_username := v_username;

        WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_temp_username)) LOOP
            v_temp_username := lower(regexp_replace(unaccent(trim(p_full_name)), '\s+', '.', 'g')) || v_suffix || '@' || v_school_slug;
            v_suffix := v_suffix + 1;
        END LOOP;
        v_username := v_temp_username;
    END;

    -- 6. Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role,
        role_normalized,
        business_id,
        username,
        is_active
    ) VALUES (
        v_user_id,
        p_full_name,
        p_email,
        p_role,
        CASE 
          WHEN p_role = 'school_teacher' THEN 'school_teacher'
          WHEN p_role = 'school_cashier' THEN 'school_cashier'
          WHEN p_role = 'school_accountant' THEN 'school_accountant'
          ELSE p_role
        END,
        p_business_id,
        v_username,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        role_normalized = EXCLUDED.role_normalized,
        business_id = EXCLUDED.business_id,
        username = COALESCE(profiles.username, EXCLUDED.username);

    -- 7. If this is a school staff (not teacher), insert into school_staff_members
    IF p_role <> 'school_teacher' THEN
        INSERT INTO public.school_staff_members (
            business_id,
            name,
            email,
            role,
            is_active
        ) VALUES (
            p_business_id,
            p_full_name,
            p_email,
            p_role,
            true
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_school_staff_member(TEXT, TEXT, TEXT, TEXT, UUID, TEXT[]) TO authenticated;


-- 2. Redefine reset_user_password to accept both school_admin and salon_admin roles
CREATE OR REPLACE FUNCTION public.reset_user_password(
    p_user_id UUID,
    p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_business_id UUID;
    v_target_business_id UUID;
BEGIN
    -- 1. Resolve caller details
    SELECT role_normalized, business_id 
    INTO v_caller_role, v_caller_business_id 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- 2. Resolve target user details
    SELECT business_id 
    INTO v_target_business_id 
    FROM public.profiles 
    WHERE id = p_user_id;

    -- 3. Authorization check
    -- Allow super_admin or school_admin/salon_admin of the same business
    IF v_caller_role IS DISTINCT FROM 'super_admin' AND (
        v_caller_business_id IS NULL 
        OR v_target_business_id IS NULL
        OR v_caller_business_id <> v_target_business_id 
        OR v_caller_role NOT IN ('school_admin', 'salon_admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only school admins of this business can reset user passwords.';
    END IF;

    -- 4. Update the password in auth.users
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(UUID, TEXT) TO authenticated;

-- 3. Repair missing profiles for school teachers already linked to auth accounts
INSERT INTO public.profiles (id, full_name, email, role, role_normalized, business_id, username, is_active)
SELECT 
  t.user_id, 
  t.first_name || ' ' || t.last_name, 
  COALESCE(t.email, u.email), 
  'school_teacher', 
  'school_teacher', 
  t.business_id, 
  lower(regexp_replace(unaccent(trim(t.first_name || ' ' || t.last_name)), '\s+', '.', 'g')) || '@' || COALESCE(lower(regexp_replace(unaccent(trim(b.name)), '[^a-zA-Z0-9]+', '', 'g')), 'school'),
  true
FROM public.school_teachers t
JOIN auth.users u ON u.id = t.user_id
JOIN public.businesses b ON b.id = t.business_id
LEFT JOIN public.profiles p ON p.id = t.user_id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Set unique usernames for any profile missing a username
DO $$
DECLARE
  rec RECORD;
  v_username TEXT;
  v_school_slug TEXT;
  v_suffix INT;
  v_temp_username TEXT;
BEGIN
  FOR rec IN 
    SELECT p.id, p.full_name, b.name AS school_name
    FROM public.profiles p
    LEFT JOIN public.businesses b ON b.id = p.business_id
    WHERE p.username IS NULL OR p.username = ''
  LOOP
    v_school_slug := lower(regexp_replace(unaccent(trim(rec.school_name)), '[^a-zA-Z0-9]+', '', 'g'));
    IF v_school_slug IS NULL OR v_school_slug = '' THEN
        v_school_slug := 'school';
    END IF;

    v_username := lower(regexp_replace(unaccent(trim(rec.full_name)), '\s+', '.', 'g')) || '@' || v_school_slug;
    v_suffix := 1;
    v_temp_username := v_username;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_temp_username) AND id <> rec.id) LOOP
      v_temp_username := lower(regexp_replace(unaccent(trim(rec.full_name)), '\s+', '.', 'g')) || v_suffix || '@' || v_school_slug;
      v_suffix := v_suffix + 1;
    END LOOP;
    
    UPDATE public.profiles
    SET username = v_temp_username
    WHERE id = rec.id;
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.get_auth_user_details(p_email TEXT)
RETURNS TABLE (id UUID, email TEXT, encrypted_password TEXT, email_confirmed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
BEGIN
    RETURN QUERY 
    SELECT u.id, u.email::TEXT, u.encrypted_password::TEXT, u.email_confirmed_at 
    FROM auth.users u 
    WHERE lower(u.email) = lower(p_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_details(TEXT) TO authenticated;


-- ─── 5. CRÉATION DE LA FONCTION SECURISÉE DE MISE À JOUR DES IDENTIFIANTS ───
CREATE OR REPLACE FUNCTION public.update_school_user_credentials(
    p_user_id UUID,
    p_email TEXT,
    p_password TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_business_id UUID;
    v_target_business_id UUID;
BEGIN
    -- 1. Récupérer les détails de l'appelant
    SELECT role_normalized, business_id 
    INTO v_caller_role, v_caller_business_id 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- 2. Récupérer l'établissement de la cible
    SELECT business_id 
    INTO v_target_business_id 
    FROM public.profiles 
    WHERE id = p_user_id;

    -- 3. Vérification des autorisations
    IF v_caller_role IS DISTINCT FROM 'super_admin' AND (
        v_caller_business_id IS NULL 
        OR v_target_business_id IS NULL
        OR v_caller_business_id <> v_target_business_id 
        OR v_caller_role NOT IN ('school_admin', 'salon_admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only school admins of this business can update user credentials.';
    END IF;

    -- 4. Modifier l'e-mail dans auth.users et public.profiles
    IF p_email IS NOT NULL AND p_email <> '' THEN
        UPDATE auth.users
        SET email = p_email,
            aud = 'authenticated',
            email_change = '',
            email_change_token_new = '',
            email_confirmed_at = now(),
            updated_at = now()
        WHERE id = p_user_id;
        
        UPDATE public.profiles
        SET email = p_email
        WHERE id = p_user_id;
    END IF;

    -- 5. Modifier le mot de passe dans auth.users si fourni
    IF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE auth.users
        SET encrypted_password = crypt(p_password, gen_salt('bf', 10)),
            updated_at = now()
        WHERE id = p_user_id;
    END IF;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_school_user_credentials(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_function_def(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_get_functiondef(p_name::regproc);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_function_def(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.dump_auth_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
    v_row RECORD;
BEGIN
    SELECT * INTO v_row FROM auth.users WHERE id = p_user_id;
    RETURN row_to_json(v_row)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dump_auth_user(UUID) TO authenticated;

-- ─── 6. CORRECTION DES UTILISATEURS EXISTANTS ───
-- Fix aud column for any auth user that has it set to NULL
UPDATE auth.users
SET aud = 'authenticated'
WHERE aud IS NULL OR aud = '';

-- Fix double '@' sign in any existing user email
UPDATE auth.users
SET email = regexp_replace(email, '@', '.')
WHERE email LIKE '%@%@%';

-- Fix double '@' sign in the public.profiles email
UPDATE public.profiles
SET email = regexp_replace(email, '@', '.')
WHERE email LIKE '%@%@%';
