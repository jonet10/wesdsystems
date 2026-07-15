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

    -- 3. Check if email already exists in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Un compte avec cet e-mail existe déjà.'
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
        email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        p_email,
        crypt(p_password, gen_salt('bf')),
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
        ''
    );

    -- Generate a clean username
    v_username := lower(regexp_replace(unaccent(trim(p_full_name)), '\s+', '.', 'g'));

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
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(UUID, TEXT) TO authenticated;
