-- WESD AUTO PARTS — Partial payment tracking
--
-- Safe for existing businesses:
-- - Adds nullable/defaulted accounting columns to existing invoices.
-- - Backfills existing rows as fully paid.
-- - Recreates create_auto_parts_sale with two extra defaulted parameters.

ALTER TABLE public.auto_parts_sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2) DEFAULT 0;

ALTER TABLE public.auto_parts_clients
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(12,2) DEFAULT 0;

UPDATE public.auto_parts_sales
SET
  amount_paid = COALESCE(NULLIF(amount_paid, 0), total, 0),
  balance_due = COALESCE(balance_due, 0)
WHERE amount_paid IS NULL OR amount_paid = 0 OR balance_due IS NULL;

CREATE INDEX IF NOT EXISTS idx_auto_parts_sales_balance_due
  ON public.auto_parts_sales(business_id, balance_due)
  WHERE balance_due > 0;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oidvectortypes(proargtypes) AS args
    FROM pg_catalog.pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'create_auto_parts_sale'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.create_auto_parts_sale(%s)', r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_auto_parts_sale(
  p_business_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax_rate NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_value NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_amount_paid NUMERIC DEFAULT NULL,
  p_balance_due NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_status TEXT DEFAULT 'paid',
  p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_cost_price NUMERIC;
  v_staff_name TEXT;
  v_prefix TEXT;
  v_amount_paid NUMERIC;
  v_balance_due NUMERIC;
  v_payment_status TEXT;
BEGIN
  v_amount_paid := LEAST(GREATEST(COALESCE(p_amount_paid, p_total), 0), p_total);
  v_balance_due := GREATEST(COALESCE(p_balance_due, p_total - v_amount_paid), 0);
  v_payment_status := CASE
    WHEN v_balance_due <= 0 THEN 'paid'
    WHEN v_amount_paid <= 0 THEN 'unpaid'
    ELSE 'partial'
  END;

  IF v_balance_due > 0 AND p_client_id IS NULL AND NULLIF(TRIM(COALESCE(p_client_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'CLIENT_REQUIRED_FOR_PARTIAL_PAYMENT'
      USING HINT = 'Un client est requis pour enregistrer un paiement partiel.';
  END IF;

  IF p_invoice_prefix IS NOT NULL THEN
    v_prefix := p_invoice_prefix;
  ELSE
    SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id;
    IF v_prefix IS NULL THEN v_prefix := 'INV-'; END IF;
  END IF;

  v_invoice := generate_auto_parts_invoice_number(p_business_id);
  v_staff_name := (
    SELECT name
    FROM public.auto_parts_staff
    WHERE id = p_staff_id AND business_id = p_business_id
  );

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, branch_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, amount_paid, balance_due, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_branch_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, v_amount_paid, v_balance_due, p_payment_method, v_payment_status, p_notes, p_staff_id, v_staff_name
  ) RETURNING id INTO v_sale_id;

  IF p_client_id IS NOT NULL AND v_balance_due > 0 THEN
    UPDATE public.auto_parts_clients
    SET credit_balance = COALESCE(credit_balance, 0) + v_balance_due
    WHERE id = p_client_id
      AND business_id = p_business_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_product_id IS NOT NULL THEN
      SELECT COALESCE(cost_price, 0) INTO v_cost_price
      FROM public.auto_parts_products
      WHERE id = v_product_id AND business_id = p_business_id;

      IF (SELECT COALESCE(stock_quantity, 0) FROM public.auto_parts_products WHERE id = v_product_id AND business_id = p_business_id) < v_quantity THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT_%', v_product_id
          USING HINT = format('Stock insuffisant pour %s', v_product_name);
      END IF;
    ELSE
      v_cost_price := 0;
    END IF;

    INSERT INTO public.auto_parts_sale_items (
      sale_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id
    ) VALUES (
      v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id, p_branch_id
    );

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (
        product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by
      ) VALUES (
        v_product_id, 'sale', -v_quantity, v_unit_price, v_cost_price, v_invoice, p_business_id, p_branch_id, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object(
      'id', s.id,
      'invoice_number', s.invoice_number,
      'total', s.total,
      'amount_paid', s.amount_paid,
      'balance_due', s.balance_due,
      'payment_status', s.payment_status
    )
    FROM public.auto_parts_sales s
    WHERE s.id = v_sale_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_auto_parts_sale(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
