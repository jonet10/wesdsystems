-- ════════════════════════════════════════════════════════════════════════════
-- Fix: update_subscription_payment must DROP first to change return type
-- (CREATE OR REPLACE cannot change RETURNS VOID → RETURNS JSONB)
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.update_subscription_payment(p_id UUID, p_transaction_reference TEXT, p_status VARCHAR);

CREATE OR REPLACE FUNCTION public.update_subscription_payment(
  p_id UUID,
  p_transaction_reference TEXT DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  UPDATE public.subscription_payments
  SET
    transaction_reference = COALESCE(p_transaction_reference, transaction_reference),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_id;

  GET DIAGNOSTICS v_found = ROW_COUNT;

  IF v_found THEN
    RETURN jsonb_build_object('success', true, 'id', p_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Aucun enregistrement trouvé');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_subscription_payment TO anon, authenticated, service_role;
