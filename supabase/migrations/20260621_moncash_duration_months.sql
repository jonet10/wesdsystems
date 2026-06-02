-- ============================================================================
-- Track MonCash subscription duration in months
-- ============================================================================

ALTER TABLE public.moncash_subscription_payments
  ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1;

UPDATE public.moncash_subscription_payments
SET duration_months = CASE
  WHEN billing_cycle = 'yearly' THEN 12
  ELSE 1
END
WHERE duration_months IS NULL OR duration_months < 1;

