-- ============================================================================
-- WESD SYSTEMS - Multi-tenant hardening for salon data isolation
-- Date: 2026-06-14
--
-- Goals:
-- - Add a canonical salon_id to salon-scoped tables
-- - Backfill existing data
-- - Replace permissive RLS policies with tenant-aware policies
-- - Ensure inserts always inherit the connected salon
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.business_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'super_admin', false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

UPDATE public.profiles
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;

CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_super_admin());

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Business-scoped tables
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.salon_branches
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_business_profiles
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_business_hours
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.employee_commissions
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.commission_rules
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.commission_transactions
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.commission_reports
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.print_templates
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

UPDATE public.salon_branches
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.salon_business_profiles
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.salon_business_hours
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.employee_commissions
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.commission_rules
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.commission_transactions
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.commission_reports
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.print_templates
SET salon_id = COALESCE(salon_id, business_id)
WHERE salon_id IS NULL AND business_id IS NOT NULL;

UPDATE public.notifications n
SET salon_id = COALESCE(n.salon_id, p.business_id)
FROM public.profiles p
WHERE p.id = n.user_id
  AND n.salon_id IS NULL
  AND p.business_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_business_salon_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.salon_id := COALESCE(NEW.salon_id, NEW.business_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_notification_salon_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.salon_id := COALESCE(NEW.salon_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_salon_id ON public.profiles;
DROP TRIGGER IF EXISTS trg_salon_branches_sync_salon_id ON public.salon_branches;
DROP TRIGGER IF EXISTS trg_salon_business_profiles_sync_salon_id ON public.salon_business_profiles;
DROP TRIGGER IF EXISTS trg_salon_business_hours_sync_salon_id ON public.salon_business_hours;
DROP TRIGGER IF EXISTS trg_employee_commissions_sync_salon_id ON public.employee_commissions;
DROP TRIGGER IF EXISTS trg_commission_rules_sync_salon_id ON public.commission_rules;
DROP TRIGGER IF EXISTS trg_commission_transactions_sync_salon_id ON public.commission_transactions;
DROP TRIGGER IF EXISTS trg_commission_reports_sync_salon_id ON public.commission_reports;
DROP TRIGGER IF EXISTS trg_print_templates_sync_salon_id ON public.print_templates;
DROP TRIGGER IF EXISTS trg_notifications_sync_salon_id ON public.notifications;

CREATE TRIGGER trg_salon_branches_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_branches
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_salon_business_profiles_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_salon_business_hours_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_business_hours
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_employee_commissions_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.employee_commissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_commission_rules_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_commission_transactions_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.commission_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_commission_reports_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.commission_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_print_templates_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.print_templates
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_salon_id();

CREATE TRIGGER trg_notifications_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notification_salon_id();

-- ---------------------------------------------------------------------------
-- Branch-scoped tables
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.salon_service_categories
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_services
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_employees
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_customers
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_appointments
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_products
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_beverages
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_inventory_movements
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_promotions
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_sales
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_sale_items
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_cash_registers
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_expenses
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_expense_categories
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.salon_employee_attendance
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.pending_tabs
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.pending_tab_items
  ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

UPDATE public.salon_service_categories sc
SET salon_id = COALESCE(sc.salon_id, b.business_id)
FROM public.salon_branches b
WHERE sc.branch_id = b.id
  AND sc.salon_id IS NULL;

UPDATE public.salon_services s
SET salon_id = COALESCE(s.salon_id, b.business_id)
FROM public.salon_branches b
WHERE s.branch_id = b.id
  AND s.salon_id IS NULL;

UPDATE public.salon_employees e
SET salon_id = COALESCE(e.salon_id, b.business_id)
FROM public.salon_branches b
WHERE e.branch_id = b.id
  AND e.salon_id IS NULL;

UPDATE public.salon_customers c
SET salon_id = COALESCE(c.salon_id, b.business_id)
FROM public.salon_branches b
WHERE c.branch_id = b.id
  AND c.salon_id IS NULL;

UPDATE public.salon_appointments a
SET salon_id = COALESCE(a.salon_id, b.business_id)
FROM public.salon_branches b
WHERE a.branch_id = b.id
  AND a.salon_id IS NULL;

UPDATE public.salon_products p
SET salon_id = COALESCE(p.salon_id, b.business_id)
FROM public.salon_branches b
WHERE p.branch_id = b.id
  AND p.salon_id IS NULL;

UPDATE public.salon_beverages bev
SET salon_id = COALESCE(bev.salon_id, b.business_id)
FROM public.salon_branches b
WHERE bev.branch_id = b.id
  AND bev.salon_id IS NULL;

UPDATE public.salon_inventory_movements m
SET salon_id = COALESCE(m.salon_id, b.business_id)
FROM public.salon_branches b
WHERE m.branch_id = b.id
  AND m.salon_id IS NULL;

UPDATE public.salon_promotions p
SET salon_id = COALESCE(p.salon_id, b.business_id)
FROM public.salon_branches b
WHERE p.branch_id = b.id
  AND p.salon_id IS NULL;

UPDATE public.salon_sales s
SET salon_id = COALESCE(s.salon_id, b.business_id)
FROM public.salon_branches b
WHERE s.branch_id = b.id
  AND s.salon_id IS NULL;

UPDATE public.salon_sale_items i
SET salon_id = COALESCE(i.salon_id, s.salon_id)
FROM public.salon_sales s
WHERE i.sale_id = s.id
  AND i.salon_id IS NULL;

UPDATE public.salon_cash_registers r
SET salon_id = COALESCE(r.salon_id, b.business_id)
FROM public.salon_branches b
WHERE r.branch_id = b.id
  AND r.salon_id IS NULL;

UPDATE public.salon_expenses e
SET salon_id = COALESCE(e.salon_id, b.business_id)
FROM public.salon_branches b
WHERE e.branch_id = b.id
  AND e.salon_id IS NULL;

UPDATE public.salon_expense_categories c
SET salon_id = COALESCE(c.salon_id, b.business_id)
FROM public.salon_branches b
WHERE c.branch_id = b.id
  AND c.salon_id IS NULL;

UPDATE public.salon_employee_attendance a
SET salon_id = COALESCE(a.salon_id, b.business_id)
FROM public.salon_branches b
WHERE a.branch_id = b.id
  AND a.salon_id IS NULL;

DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    UPDATE public.pending_tabs t
    SET salon_id = COALESCE(t.salon_id, b.business_id)
    FROM public.salon_branches b
    WHERE t.branch_id = b.id
      AND t.salon_id IS NULL;
  END IF;

  IF to_regclass('public.pending_tab_items') IS NOT NULL AND to_regclass('public.pending_tabs') IS NOT NULL THEN
    UPDATE public.pending_tab_items i
    SET salon_id = COALESCE(i.salon_id, t.salon_id)
    FROM public.pending_tabs t
    WHERE i.tab_id = t.id
      AND i.salon_id IS NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_branch_salon_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.business_id
      INTO v_business_id
    FROM public.salon_branches b
    WHERE b.id = NEW.branch_id
    LIMIT 1;
  END IF;

  NEW.salon_id := COALESCE(NEW.salon_id, NEW.business_id, v_business_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_sale_item_salon_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  SELECT s.salon_id
    INTO v_salon_id
  FROM public.salon_sales s
  WHERE s.id = NEW.sale_id
  LIMIT 1;

  NEW.salon_id := COALESCE(NEW.salon_id, v_salon_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.sync_pending_tab_salon_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_salon_id UUID;
      BEGIN
        SELECT t.salon_id
          INTO v_salon_id
        FROM public.pending_tabs t
        WHERE t.id = NEW.tab_id
        LIMIT 1;

        NEW.salon_id := COALESCE(NEW.salon_id, v_salon_id, public.current_user_business_id());
        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_salon_service_categories_sync_salon_id ON public.salon_service_categories;
DROP TRIGGER IF EXISTS trg_salon_services_sync_salon_id ON public.salon_services;
DROP TRIGGER IF EXISTS trg_salon_employees_sync_salon_id ON public.salon_employees;
DROP TRIGGER IF EXISTS trg_salon_customers_sync_salon_id ON public.salon_customers;
DROP TRIGGER IF EXISTS trg_salon_appointments_sync_salon_id ON public.salon_appointments;
DROP TRIGGER IF EXISTS trg_salon_products_sync_salon_id ON public.salon_products;
DROP TRIGGER IF EXISTS trg_salon_beverages_sync_salon_id ON public.salon_beverages;
DROP TRIGGER IF EXISTS trg_salon_inventory_movements_sync_salon_id ON public.salon_inventory_movements;
DROP TRIGGER IF EXISTS trg_salon_promotions_sync_salon_id ON public.salon_promotions;
DROP TRIGGER IF EXISTS trg_salon_sales_sync_salon_id ON public.salon_sales;
DROP TRIGGER IF EXISTS trg_salon_sale_items_sync_salon_id ON public.salon_sale_items;
DROP TRIGGER IF EXISTS trg_salon_cash_registers_sync_salon_id ON public.salon_cash_registers;
DROP TRIGGER IF EXISTS trg_salon_expenses_sync_salon_id ON public.salon_expenses;
DROP TRIGGER IF EXISTS trg_salon_expense_categories_sync_salon_id ON public.salon_expense_categories;
DROP TRIGGER IF EXISTS trg_salon_employee_attendance_sync_salon_id ON public.salon_employee_attendance;
DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_pending_tabs_sync_salon_id ON public.pending_tabs;
  END IF;

  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_pending_tab_items_sync_salon_id ON public.pending_tab_items;
  END IF;
END $$;

CREATE TRIGGER trg_salon_service_categories_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_service_categories
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_services_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_services
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_employees_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_customers_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_appointments_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_products_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_products
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_beverages_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_beverages
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_inventory_movements_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_promotions_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_promotions
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_sales_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_sale_items_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_item_salon_id();
CREATE TRIGGER trg_salon_cash_registers_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_expenses_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_expense_categories_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
CREATE TRIGGER trg_salon_employee_attendance_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_employee_attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    CREATE TRIGGER trg_pending_tabs_sync_salon_id
      BEFORE INSERT OR UPDATE ON public.pending_tabs
      FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();
  END IF;

  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    CREATE TRIGGER trg_pending_tab_items_sync_salon_id
      BEFORE INSERT OR UPDATE ON public.pending_tab_items
      FOR EACH ROW EXECUTE FUNCTION public.sync_pending_tab_salon_id();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS replacement: remove permissive policies and replace with tenant-aware ones
-- ---------------------------------------------------------------------------

ALTER TABLE public.salon_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    ALTER TABLE public.pending_tabs ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    ALTER TABLE public.pending_tab_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Old policies that were effectively global
DROP POLICY IF EXISTS salon_branches_select ON public.salon_branches;
DROP POLICY IF EXISTS salon_branches_insert ON public.salon_branches;
DROP POLICY IF EXISTS salon_branches_update ON public.salon_branches;
DROP POLICY IF EXISTS salon_services_select ON public.salon_services;
DROP POLICY IF EXISTS salon_services_insert ON public.salon_services;
DROP POLICY IF EXISTS salon_services_update ON public.salon_services;
DROP POLICY IF EXISTS salon_services_delete ON public.salon_services;
DROP POLICY IF EXISTS salon_customers_select ON public.salon_customers;
DROP POLICY IF EXISTS salon_customers_insert ON public.salon_customers;
DROP POLICY IF EXISTS salon_customers_update ON public.salon_customers;
DROP POLICY IF EXISTS salon_customers_delete ON public.salon_customers;
DROP POLICY IF EXISTS salon_appointments_select ON public.salon_appointments;
DROP POLICY IF EXISTS salon_appointments_insert ON public.salon_appointments;
DROP POLICY IF EXISTS salon_appointments_update ON public.salon_appointments;
DROP POLICY IF EXISTS salon_appointments_delete ON public.salon_appointments;
DROP POLICY IF EXISTS salon_products_select ON public.salon_products;
DROP POLICY IF EXISTS salon_products_insert ON public.salon_products;
DROP POLICY IF EXISTS salon_products_update ON public.salon_products;
DROP POLICY IF EXISTS salon_products_delete ON public.salon_products;
DROP POLICY IF EXISTS salon_beverages_select ON public.salon_beverages;
DROP POLICY IF EXISTS salon_beverages_insert ON public.salon_beverages;
DROP POLICY IF EXISTS salon_beverages_update ON public.salon_beverages;
DROP POLICY IF EXISTS salon_sales_select ON public.salon_sales;
DROP POLICY IF EXISTS salon_sales_insert ON public.salon_sales;
DROP POLICY IF EXISTS salon_sale_items_insert ON public.salon_sale_items;
DROP POLICY IF EXISTS salon_sale_items_select ON public.salon_sale_items;
DROP POLICY IF EXISTS salon_sale_items_update ON public.salon_sale_items;
DROP POLICY IF EXISTS salon_sale_items_delete ON public.salon_sale_items;
DROP POLICY IF EXISTS salon_employees_select ON public.salon_employees;
DROP POLICY IF EXISTS salon_employees_insert ON public.salon_employees;
DROP POLICY IF EXISTS salon_employees_update ON public.salon_employees;
DROP POLICY IF EXISTS salon_employees_delete ON public.salon_employees;
DROP POLICY IF EXISTS salon_expenses_select ON public.salon_expenses;
DROP POLICY IF EXISTS salon_expenses_insert ON public.salon_expenses;
DROP POLICY IF EXISTS salon_expenses_update ON public.salon_expenses;
DROP POLICY IF EXISTS salon_expenses_delete ON public.salon_expenses;
DROP POLICY IF EXISTS salon_expense_categories_select ON public.salon_expense_categories;
DROP POLICY IF EXISTS salon_employee_attendance_select ON public.salon_employee_attendance;
DROP POLICY IF EXISTS salon_inventory_movements_all ON public.salon_inventory_movements;
DROP POLICY IF EXISTS salon_cash_registers_all ON public.salon_cash_registers;
DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    DROP POLICY IF EXISTS pending_tabs_all ON public.pending_tabs;
    DROP POLICY IF EXISTS pending_tabs_tenant_guard ON public.pending_tabs;
  END IF;
  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS pending_tab_items_all ON public.pending_tab_items;
    DROP POLICY IF EXISTS pending_tab_items_tenant_guard ON public.pending_tab_items;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can read own business profile" ON public.salon_business_profiles;
DROP POLICY IF EXISTS "Users can insert own business profile" ON public.salon_business_profiles;
DROP POLICY IF EXISTS "Users can update own business profile" ON public.salon_business_profiles;
DROP POLICY IF EXISTS "Users can read own business hours" ON public.salon_business_hours;
DROP POLICY IF EXISTS "Users can manage own business hours" ON public.salon_business_hours;
DROP POLICY IF EXISTS "Users can update own business hours" ON public.salon_business_hours;
DROP POLICY IF EXISTS "Users can delete own business hours" ON public.salon_business_hours;
DROP POLICY IF EXISTS "Users can read employee commissions" ON public.employee_commissions;
DROP POLICY IF EXISTS "Users can manage employee commissions" ON public.employee_commissions;
DROP POLICY IF EXISTS "Users can read commission rules" ON public.commission_rules;
DROP POLICY IF EXISTS "Users can manage commission rules" ON public.commission_rules;
DROP POLICY IF EXISTS "Users can update commission rules" ON public.commission_rules;
DROP POLICY IF EXISTS "Users can delete commission rules" ON public.commission_rules;
DROP POLICY IF EXISTS "Users can read commission transactions" ON public.commission_transactions;
DROP POLICY IF EXISTS "Users can insert commission transactions" ON public.commission_transactions;
DROP POLICY IF EXISTS "Users can update commission transactions" ON public.commission_transactions;
DROP POLICY IF EXISTS "Users can read commission reports" ON public.commission_reports;
DROP POLICY IF EXISTS "Users can manage commission reports" ON public.commission_reports;
DROP POLICY IF EXISTS "Users can read print templates" ON public.print_templates;
DROP POLICY IF EXISTS "Users can manage print templates" ON public.print_templates;
DROP POLICY IF EXISTS "Users can update print templates" ON public.print_templates;
DROP POLICY IF EXISTS "Users can delete print templates" ON public.print_templates;
DROP POLICY IF EXISTS "notifications readable" ON public.notifications;
DROP POLICY IF EXISTS "notifications update own" ON public.notifications;

-- Tenant-aware policies
CREATE POLICY salon_branches_tenant_guard ON public.salon_branches
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_service_categories_tenant_guard ON public.salon_service_categories
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_services_tenant_guard ON public.salon_services
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_employees_tenant_guard ON public.salon_employees
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_customers_tenant_guard ON public.salon_customers
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_appointments_tenant_guard ON public.salon_appointments
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_products_tenant_guard ON public.salon_products
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_beverages_tenant_guard ON public.salon_beverages
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_inventory_movements_tenant_guard ON public.salon_inventory_movements
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_promotions_tenant_guard ON public.salon_promotions
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_sales_tenant_guard ON public.salon_sales
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_sale_items_tenant_guard ON public.salon_sale_items
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_cash_registers_tenant_guard ON public.salon_cash_registers
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_expenses_tenant_guard ON public.salon_expenses
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_expense_categories_tenant_guard ON public.salon_expense_categories
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_employee_attendance_tenant_guard ON public.salon_employee_attendance
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    CREATE POLICY pending_tabs_tenant_guard ON public.pending_tabs
      FOR ALL
      USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
      WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());
  END IF;

  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    CREATE POLICY pending_tab_items_tenant_guard ON public.pending_tab_items
      FOR ALL
      USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
      WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());
  END IF;
END $$;

CREATE POLICY notifications_tenant_guard ON public.notifications
  FOR ALL
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR salon_id = public.current_user_business_id()
  )
  WITH CHECK (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR salon_id = public.current_user_business_id()
  );

CREATE POLICY salon_business_profiles_tenant_guard ON public.salon_business_profiles
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_business_hours_tenant_guard ON public.salon_business_hours
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY employee_commissions_tenant_guard ON public.employee_commissions
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY commission_rules_tenant_guard ON public.commission_rules
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY commission_transactions_tenant_guard ON public.commission_transactions
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY commission_reports_tenant_guard ON public.commission_reports
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY print_templates_tenant_guard ON public.print_templates
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_salon_id ON public.profiles(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_branches_salon_id ON public.salon_branches(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_business_profiles_salon_id ON public.salon_business_profiles(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_business_hours_salon_id ON public.salon_business_hours(salon_id);
CREATE INDEX IF NOT EXISTS idx_employee_commissions_salon_id ON public.employee_commissions(salon_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_salon_id ON public.commission_rules(salon_id);
CREATE INDEX IF NOT EXISTS idx_commission_transactions_salon_id ON public.commission_transactions(salon_id);
CREATE INDEX IF NOT EXISTS idx_commission_reports_salon_id ON public.commission_reports(salon_id);
CREATE INDEX IF NOT EXISTS idx_print_templates_salon_id ON public.print_templates(salon_id);
CREATE INDEX IF NOT EXISTS idx_notifications_salon_id ON public.notifications(salon_id);

CREATE INDEX IF NOT EXISTS idx_salon_service_categories_salon_id ON public.salon_service_categories(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_salon_id ON public.salon_services(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_employees_salon_id ON public.salon_employees(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_customers_salon_id ON public.salon_customers(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_salon_id ON public.salon_appointments(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_products_salon_id ON public.salon_products(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_beverages_salon_id ON public.salon_beverages(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_inventory_movements_salon_id ON public.salon_inventory_movements(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_promotions_salon_id ON public.salon_promotions(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_sales_salon_id ON public.salon_sales(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_sale_items_salon_id ON public.salon_sale_items(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_cash_registers_salon_id ON public.salon_cash_registers(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_expenses_salon_id ON public.salon_expenses(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_expense_categories_salon_id ON public.salon_expense_categories(salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_employee_attendance_salon_id ON public.salon_employee_attendance(salon_id);
DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_pending_tabs_salon_id ON public.pending_tabs(salon_id);
  END IF;
  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_pending_tab_items_salon_id ON public.pending_tab_items(salon_id);
  END IF;
END $$;
