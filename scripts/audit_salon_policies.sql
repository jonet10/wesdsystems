-- Audit RLS policies for salon isolation.
-- This script lists permissive policies and missing policy coverage
-- for salon-related tables.

WITH target_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'salon_branches',
    'salon_service_categories',
    'salon_services',
    'salon_employees',
    'salon_customers',
    'salon_appointments',
    'salon_products',
    'salon_beverages',
    'salon_inventory_movements',
    'salon_promotions',
    'salon_sales',
    'salon_sale_items',
    'salon_cash_registers',
    'salon_expenses',
    'salon_expense_categories',
    'salon_employee_attendance',
    'salon_business_profiles',
    'salon_business_hours',
    'employee_commissions',
    'commission_rules',
    'commission_transactions',
    'commission_reports',
    'print_templates',
    'notifications',
    'pending_tabs',
    'pending_tab_items'
  ]) AS table_name
),
table_info AS (
  SELECT
    tt.table_name,
    c.oid AS relid,
    c.relrowsecurity AS rls_enabled
  FROM target_tables tt
  LEFT JOIN pg_catalog.pg_class c
    ON c.relname = tt.table_name
  LEFT JOIN pg_catalog.pg_namespace n
    ON n.oid = c.relnamespace
   AND n.nspname = 'public'
),
policy_info AS (
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,
    p.cmd,
    p.roles,
    p.permissive,
    p.qual,
    p.with_check
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
),
policy_summary AS (
  SELECT
    ti.table_name,
    ti.rls_enabled,
    COUNT(pi.policyname) AS policy_count,
    COUNT(*) FILTER (WHERE pi.qual ILIKE '%true%') AS using_true_count,
    COUNT(*) FILTER (WHERE pi.with_check ILIKE '%true%') AS with_check_true_count,
    COUNT(*) FILTER (WHERE pi.cmd = 'ALL') AS all_policy_count,
    ARRAY_REMOVE(ARRAY_AGG(pi.policyname ORDER BY pi.policyname), NULL) AS policy_names
  FROM table_info ti
  LEFT JOIN policy_info pi
    ON pi.tablename = ti.table_name
  GROUP BY ti.table_name, ti.rls_enabled
)
SELECT
  table_name,
  rls_enabled,
  policy_count,
  using_true_count,
  with_check_true_count,
  all_policy_count,
  policy_names,
  CASE
    WHEN rls_enabled IS DISTINCT FROM true THEN 'RLS_DISABLED'
    WHEN policy_count = 0 THEN 'NO_POLICY'
    WHEN using_true_count > 0 OR with_check_true_count > 0 THEN 'PERMISSIVE_POLICY'
    ELSE 'OK'
  END AS status
FROM policy_summary
ORDER BY
  CASE
    WHEN rls_enabled IS DISTINCT FROM true THEN 0
    WHEN policy_count = 0 THEN 1
    WHEN using_true_count > 0 OR with_check_true_count > 0 THEN 2
    ELSE 3
  END,
  table_name;

