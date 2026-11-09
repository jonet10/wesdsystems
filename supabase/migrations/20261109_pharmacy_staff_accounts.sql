-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20261109: Pharmacy staff accounts (username + PIN)
--
-- The pharmacy module had no way for an admin to create a cashier account.
-- Unlike salon/auto-parts (which use dedicated tables + PIN sessions), pharmacy
-- pages query Supabase directly under RLS, so cashiers must be real Supabase
-- Auth users (auth.uid() is required by the RLS policies).
--
-- This migration adds:
--   • can_manage_pharmacy_staff()      – authorization helper (SECURITY DEFINER)
--   • pharmacy_list_staff()            – list pharmacy staff of a business
--   • create_pharmacy_staff_member()   – create auth.users + profiles (username + PIN)
--   • update_pharmacy_staff_member()   – edit name/role/username/active + reset PIN
--   • get_pharmacy_login_email()       – anon-callable username+PIN → internal email
--
-- Internal login email format: <username>@staff.wesdsystems.local
-- The PIN is stored as the Supabase Auth password (bcrypt), so the standard
-- signInWithPassword() flow is used by the client.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── 1. Authorization helper ────────────────────────────────────────────────
-- SECURITY DEFINER avoids recursive RLS lookups on public.profiles.
CREATE OR REPLACE FUNCTION public.can_manage_pharmacy_staff(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id = p_business_id
        AND COALESCE(p.role_normalized, p.role) IN (
          'salon_admin', 'studio_admin', 'owner', 'business_owner', 'pharmacy_admin'
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_pharmacy_staff(UUID) TO authenticated;

-- ─── 2. List pharmacy staff ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pharmacy_list_staff(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.can_manage_pharmacy_staff(p_business_id) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.full_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      p.id,
      p.full_name,
      p.username,
      p.email,
      p.role,
      p.is_active,
      p.created_at
    FROM public.profiles p
    WHERE p.business_id = p_business_id
      AND (
        p.role LIKE 'pharmacy_%'
        OR p.role_normalized LIKE 'pharmacy_%'
      )
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pharmacy_list_staff(UUID) TO authenticated;

-- ─── 3. Create a pharmacy staff account ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_pharmacy_staff_member(
  p_business_id UUID,
  p_full_name   TEXT,
  p_username    TEXT,
  p_pin         TEXT,
  p_role        TEXT DEFAULT 'pharmacy_cashier',
  p_email       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
  v_username           TEXT;
  v_base               TEXT;
  v_email              TEXT;
  v_user_id            UUID;
  v_existing_id        UUID;
  v_stray_business_id  UUID;
  v_suffix             INT := 1;
BEGIN
  -- Authorization
  IF NOT public.can_manage_pharmacy_staff(p_business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;

  -- Validate role
  IF p_role IS NULL OR p_role NOT IN (
    'pharmacy_admin',
    'pharmacy_manager',
    'pharmacy_cashier',
    'pharmacy_stock_manager',
    'pharmacy_accountant'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide.');
  END IF;

  -- Validate PIN (Supabase password minimum length is 6)
  IF p_pin IS NULL OR length(trim(p_pin)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le PIN doit contenir au moins 6 caractères.');
  END IF;

  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis.');
  END IF;

  -- Normalize username (fallback: derived from full name)
  IF p_username IS NOT NULL AND trim(p_username) <> '' THEN
    v_base := lower(regexp_replace(unaccent(trim(p_username)), '[^a-zA-Z0-9]+', '.', 'g'));
  ELSE
    v_base := lower(regexp_replace(unaccent(trim(p_full_name)), '[^a-zA-Z0-9]+', '.', 'g'));
  END IF;

  v_base := trim(both '.' from regexp_replace(v_base, '\.+', '.', 'g'));
  IF v_base IS NULL OR v_base = '' THEN
    v_base := 'caissier';
  END IF;

  v_username := v_base;

  -- Ensure uniqueness across every login surface (profiles + salon + auto-parts)
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username))
     OR EXISTS (SELECT 1 FROM public.salon_employees WHERE lower(username) = lower(v_username))
     OR EXISTS (SELECT 1 FROM public.auto_parts_staff WHERE lower(username) = lower(v_username))
  LOOP
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix::TEXT;
  END LOOP;

  -- Internal email used for Supabase Auth
  v_email := COALESCE(NULLIF(lower(trim(p_email)), ''), v_username || '@staff.wesdsystems.local');

  SELECT id INTO v_existing_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte existe déjà avec cet email.');
  END IF;

  v_user_id := gen_random_uuid();

  -- Create the Supabase Auth user (PIN acts as the password)
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
    v_email,
    crypt(trim(p_pin), gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role,
      'business_id', p_business_id,
      'business_type', 'pharmacie',
      'username', v_username
    ),
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

  -- handle_new_user() may have created a stray business/profile: capture it so
  -- we can clean it up after repointing the profile to the real pharmacy.
  SELECT business_id INTO v_stray_business_id FROM public.profiles WHERE id = v_user_id;

  -- Upsert the profile with the correct pharmacy ownership/role
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    role_normalized,
    business_id,
    business_type,
    username,
    is_active
  ) VALUES (
    v_user_id,
    p_full_name,
    v_email,
    p_role,
    p_role,
    p_business_id,
    'pharmacie',
    v_username,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    email            = EXCLUDED.email,
    role             = EXCLUDED.role,
    role_normalized  = EXCLUDED.role_normalized,
    business_id      = EXCLUDED.business_id,
    business_type    = EXCLUDED.business_type,
    username         = EXCLUDED.username,
    is_active        = true;

  -- Best-effort cleanup of the business auto-created by handle_new_user()
  IF v_stray_business_id IS NOT NULL AND v_stray_business_id <> p_business_id THEN
    BEGIN
      DELETE FROM public.businesses b
      WHERE b.id = v_stray_business_id
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.business_id = b.id
        );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never block staff creation because of cleanup
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', v_username,
    'email', v_email,
    'role', p_role
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce nom d''utilisateur est déjà utilisé.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pharmacy_staff_member(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 4. Update a pharmacy staff account ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_pharmacy_staff_member(
  p_user_id    UUID,
  p_full_name  TEXT DEFAULT NULL,
  p_role       TEXT DEFAULT NULL,
  p_is_active  BOOLEAN DEFAULT NULL,
  p_username   TEXT DEFAULT NULL,
  p_pin        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
  v_business_id UUID;
  v_role        TEXT;
  v_username    TEXT;
BEGIN
  SELECT business_id, role INTO v_business_id, v_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employé introuvable.');
  END IF;

  IF NOT public.can_manage_pharmacy_staff(v_business_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;

  IF v_role IS NULL OR v_role NOT LIKE 'pharmacy_%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet utilisateur n''est pas un employé de pharmacie.');
  END IF;

  IF p_role IS NOT NULL THEN
    IF p_role NOT IN (
      'pharmacy_admin',
      'pharmacy_manager',
      'pharmacy_cashier',
      'pharmacy_stock_manager',
      'pharmacy_accountant'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide.');
    END IF;

    UPDATE public.profiles
    SET role = p_role, role_normalized = p_role
    WHERE id = p_user_id;
  END IF;

  IF p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
    UPDATE public.profiles SET full_name = trim(p_full_name) WHERE id = p_user_id;
  END IF;

  IF p_username IS NOT NULL AND trim(p_username) <> '' THEN
    v_username := lower(regexp_replace(unaccent(trim(p_username)), '[^a-zA-Z0-9]+', '.', 'g'));
    v_username := trim(both '.' from regexp_replace(v_username, '\.+', '.', 'g'));

    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE lower(username) = lower(v_username) AND id <> p_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.salon_employees WHERE lower(username) = lower(v_username)
    ) OR EXISTS (
      SELECT 1 FROM public.auto_parts_staff WHERE lower(username) = lower(v_username)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce nom d''utilisateur est déjà utilisé.');
    END IF;

    UPDATE public.profiles SET username = v_username WHERE id = p_user_id;
  END IF;

  IF p_pin IS NOT NULL AND trim(p_pin) <> '' THEN
    IF length(trim(p_pin)) < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le PIN doit contenir au moins 6 caractères.');
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(trim(p_pin), gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF p_is_active IS NOT NULL THEN
    UPDATE public.profiles SET is_active = p_is_active WHERE id = p_user_id;

    -- Block/unblock actual sign-in, not just the app UI
    UPDATE auth.users
    SET banned_until = CASE WHEN p_is_active THEN NULL ELSE now() + interval '100 years' END,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce nom d''utilisateur est déjà utilisé.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pharmacy_staff_member(UUID, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ─── 5. Username + PIN → internal auth email (callable by anon) ─────────────
CREATE OR REPLACE FUNCTION public.get_pharmacy_login_email(
  p_username TEXT,
  p_pin      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id        UUID;
  v_role      TEXT;
  v_business  UUID;
  v_email     TEXT;
  v_hash      TEXT;
BEGIN
  SELECT p.id, p.role, p.business_id
  INTO v_id, v_role, v_business
  FROM public.profiles p
  WHERE lower(p.username) = lower(trim(p_username))
    AND p.is_active = true
    AND (p.role LIKE 'pharmacy_%' OR p.role_normalized LIKE 'pharmacy_%')
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT u.email, u.encrypted_password
  INTO v_email, v_hash
  FROM auth.users u
  WHERE u.id = v_id
    AND (u.banned_until IS NULL OR u.banned_until < now());

  IF v_email IS NULL OR v_hash IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  -- Verify the PIN against the Supabase Auth password hash
  IF crypt(trim(p_pin), v_hash) <> v_hash THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_email,
    'user_id', v_id,
    'role', v_role,
    'business_id', v_business
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pharmacy_login_email(TEXT, TEXT) TO anon, authenticated;
