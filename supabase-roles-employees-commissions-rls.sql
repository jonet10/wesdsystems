-- =================================================================================
-- WESD SYSTEMS - MIGRATION INCREMENTALE (SERVERLESS SUPABASE)
-- Roles + Espace employes + Commissions + RLS multi-tenant
-- Date: 2026-05-18
--
-- ROLLBACK (safe, manuel):
-- 1) DROP POLICY ... sur les objets crees ici
-- 2) DROP FUNCTION public.calculate_employee_commission(...)
-- 3) DROP TABLE public.employee_service_commissions, public.employee_commissions, public.employee_accounts
-- 4) Optionnel: remettre les anciennes contraintes role/profiles
-- =================================================================================

BEGIN;

-- 0) Renforcement des roles applicatifs (sans casser les roles existants)
-- On normalise progressivement vers:
-- super_admin | studio_admin | employee | client
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_normalized text;

UPDATE public.profiles
SET role_normalized = CASE
  WHEN role IN ('super_admin') THEN 'super_admin'
  WHEN role IN ('owner', 'salon_admin', 'studio_admin') THEN 'studio_admin'
  WHEN role IN ('employee', 'staff') THEN 'employee'
  ELSE 'client'
END
WHERE role_normalized IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_normalized_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_normalized_chk
      CHECK (role_normalized IN ('super_admin', 'studio_admin', 'employee', 'client'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role_normalized ON public.profiles(role_normalized);
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);

-- 1) Table de liaison employe <-> auth user
-- Permet de relier un enregistrement employee metier au compte auth supabase.
CREATE TABLE IF NOT EXISTS public.employee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_accounts_business ON public.employee_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_employee_accounts_auth_user ON public.employee_accounts(auth_user_id);

-- 2) Commissions employes (global + snapshots periodiques)
CREATE TABLE IF NOT EXISTS public.employee_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  global_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (global_rate >= 0 AND global_rate <= 100),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_revenue numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency_code varchar(3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_commissions_business_employee
  ON public.employee_commissions(business_id, employee_id, period_start, period_end);

-- 3) Commission par service (prioritaire sur la commission globale)
CREATE TABLE IF NOT EXISTS public.employee_service_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  rate numeric(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, employee_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_service_commissions_lookup
  ON public.employee_service_commissions(business_id, employee_id, service_id);

-- 4) Fonction SQL securisee de calcul commission (jour/semaine/mois)
-- Remarque: transactions.amount + transactions.service_id + transactions.employee_id
-- sont supposes exister. Adaptez les noms si votre schema differe.
CREATE OR REPLACE FUNCTION public.calculate_employee_commission(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  gross_revenue numeric,
  commission_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  -- Multi-tenant guard par employee + business
  SELECT e.business_id INTO v_business_id
  FROM public.employees e
  WHERE e.id = p_employee_id
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  RETURN QUERY
  WITH tx AS (
    SELECT
      t.amount::numeric AS amount,
      t.service_id::uuid AS service_id
    FROM public.transactions t
    WHERE t.employee_id = p_employee_id
      AND t.business_id = v_business_id
      AND t.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  rates AS (
    SELECT
      tx.amount,
      COALESCE(esc.rate, ec.global_rate, 0) AS applied_rate
    FROM tx
    LEFT JOIN public.employee_service_commissions esc
      ON esc.employee_id = p_employee_id
      AND esc.business_id = v_business_id
      AND esc.service_id = tx.service_id
    LEFT JOIN LATERAL (
      SELECT global_rate
      FROM public.employee_commissions ec
      WHERE ec.employee_id = p_employee_id
        AND ec.business_id = v_business_id
      ORDER BY ec.created_at DESC
      LIMIT 1
    ) ec ON true
  )
  SELECT
    COALESCE(SUM(amount), 0) AS gross_revenue,
    COALESCE(SUM(amount * (applied_rate / 100.0)), 0) AS commission_total
  FROM rates;
END;
$$;

-- 5) RLS multi-tenant stricte
ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_service_commissions ENABLE ROW LEVEL SECURITY;

-- employee_accounts
DROP POLICY IF EXISTS employee_accounts_select_policy ON public.employee_accounts;
CREATE POLICY employee_accounts_select_policy ON public.employee_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (
          p.role_normalized = 'studio_admin'
          AND p.business_id = employee_accounts.business_id
        )
        OR (
          p.role_normalized = 'employee'
          AND employee_accounts.auth_user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS employee_accounts_manage_policy ON public.employee_accounts;
CREATE POLICY employee_accounts_manage_policy ON public.employee_accounts
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_accounts.business_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_accounts.business_id)
      )
  )
);

-- employee_commissions
DROP POLICY IF EXISTS employee_commissions_select_policy ON public.employee_commissions;
CREATE POLICY employee_commissions_select_policy ON public.employee_commissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.employee_accounts ea
      ON ea.employee_id = employee_commissions.employee_id
      AND ea.business_id = employee_commissions.business_id
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_commissions.business_id)
        OR (p.role_normalized = 'employee' AND ea.auth_user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS employee_commissions_manage_policy ON public.employee_commissions;
CREATE POLICY employee_commissions_manage_policy ON public.employee_commissions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_commissions.business_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_commissions.business_id)
      )
  )
);

-- employee_service_commissions
DROP POLICY IF EXISTS employee_service_commissions_select_policy ON public.employee_service_commissions;
CREATE POLICY employee_service_commissions_select_policy ON public.employee_service_commissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.employee_accounts ea
      ON ea.employee_id = employee_service_commissions.employee_id
      AND ea.business_id = employee_service_commissions.business_id
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_service_commissions.business_id)
        OR (p.role_normalized = 'employee' AND ea.auth_user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS employee_service_commissions_manage_policy ON public.employee_service_commissions;
CREATE POLICY employee_service_commissions_manage_policy ON public.employee_service_commissions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_service_commissions.business_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role_normalized = 'super_admin'
        OR (p.role_normalized = 'studio_admin' AND p.business_id = employee_service_commissions.business_id)
      )
  )
);

COMMIT;
