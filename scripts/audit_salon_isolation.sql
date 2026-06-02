-- Run this after the hardening migration to detect tenant-isolation anomalies.

DROP TABLE IF EXISTS audit_results;
CREATE TEMP TABLE audit_results (
  table_name text NOT NULL,
  anomaly_count bigint NOT NULL,
  sample_ids uuid[]
) ON COMMIT DROP;

INSERT INTO audit_results
SELECT
  'salon_branches'::text AS table_name,
  COUNT(*) FILTER (WHERE salon_id IS NULL OR business_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR business_id IS NULL), NULL) AS sample_ids
FROM public.salon_branches;

INSERT INTO audit_results
SELECT
  'profiles',
  COUNT(*) FILTER (WHERE salon_id IS NULL AND business_id IS NOT NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL AND business_id IS NOT NULL), NULL) AS sample_ids
FROM public.profiles;

INSERT INTO audit_results
SELECT
  'salon_customers',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_customers;

INSERT INTO audit_results
SELECT
  'salon_products',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_products;

INSERT INTO audit_results
SELECT
  'salon_sales',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_sales;

INSERT INTO audit_results
SELECT
  'salon_sale_items',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR sale_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR sale_id IS NULL), NULL) AS sample_ids
FROM public.salon_sale_items;

INSERT INTO audit_results
SELECT
  'salon_appointments',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_appointments;

INSERT INTO audit_results
SELECT
  'salon_inventory_movements',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_inventory_movements;

INSERT INTO audit_results
SELECT
  'salon_expenses',
  COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
  ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
FROM public.salon_expenses;

DO $$
BEGIN
  IF to_regclass('public.pending_tabs') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO audit_results
      SELECT
        'pending_tabs',
        COUNT(*) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL) AS anomaly_count,
        ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR branch_id IS NULL), NULL) AS sample_ids
      FROM public.pending_tabs
    $sql$;
  END IF;

  IF to_regclass('public.pending_tab_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO audit_results
      SELECT
        'pending_tab_items',
        COUNT(*) FILTER (WHERE salon_id IS NULL OR tab_id IS NULL) AS anomaly_count,
        ARRAY_REMOVE(ARRAY_AGG(id) FILTER (WHERE salon_id IS NULL OR tab_id IS NULL), NULL) AS sample_ids
      FROM public.pending_tab_items
    $sql$;
  END IF;
END $$;

SELECT
  table_name,
  anomaly_count,
  sample_ids
FROM audit_results
ORDER BY anomaly_count DESC, table_name;

