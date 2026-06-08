-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Product returns / refunds
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add refund columns to auto_parts_sales ───
ALTER TABLE public.auto_parts_sales ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
  CHECK (refund_status IN ('none', 'partial', 'full'));
ALTER TABLE public.auto_parts_sales ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- ─── 2. Process a return (reverse stock, update sale refund_status) ───
CREATE OR REPLACE FUNCTION public.process_auto_parts_return(
  p_business_id UUID,
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_total_return_qty NUMERIC := 0;
  v_total_sold_qty NUMERIC := 0;
  v_staff_id UUID;
BEGIN
  -- Validate sale exists and belongs to this business
  SELECT * INTO v_sale
  FROM public.auto_parts_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  -- Resolve staff_id from session context
  v_staff_id := public.current_auto_parts_staff_id();
  IF v_staff_id IS NULL THEN
    v_staff_id := auth.uid();
  END IF;

  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_total_return_qty := v_total_return_qty + v_quantity;

    -- Insert stock movement (positive quantity = stock goes back in)
    INSERT INTO public.auto_parts_stock_movements
      (product_id, type, quantity, unit_price, reference, notes, business_id, created_by)
    VALUES
      (v_product_id, 'return', v_quantity, v_unit_price, v_sale.invoice_number, p_reason, p_business_id, v_staff_id);
  END LOOP;

  -- Compute total sold quantity for this sale
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.auto_parts_sale_items
  WHERE sale_id = p_sale_id;

  -- Update refund_status
  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.auto_parts_sales
    SET refund_status = 'full', refunded_at = now()
    WHERE id = p_sale_id;
  ELSE
    UPDATE public.auto_parts_sales
    SET refund_status = 'partial', refunded_at = now()
    WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'refund_status', CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END
  );
END;
$$;

-- ─── 3. List returns (stock movements of type 'return' with sale info) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_returns(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(sm) || jsonb_build_object(
        'product', CASE WHEN sm.product_id IS NOT NULL THEN
          (SELECT to_jsonb(pr) FROM (SELECT p.id, p.name FROM public.auto_parts_products p WHERE p.id = sm.product_id) pr)
        ELSE NULL END,
        'sale', CASE WHEN sm.reference IS NOT NULL THEN
          (SELECT to_jsonb(s) FROM (
            SELECT s.id, s.invoice_number, s.total, s.refund_status, s.refunded_at, s.client_name
            FROM public.auto_parts_sales s WHERE s.invoice_number = sm.reference
          ) s)
        ELSE NULL END
      )
      ORDER BY sm.created_at DESC
    ), '[]'::jsonb)
    FROM public.auto_parts_stock_movements sm
    WHERE sm.business_id = p_business_id AND sm.type = 'return'
    LIMIT 200
  );
END;
$$;

-- ─── 4. Helper: get current auto_parts staff_id from session ───
CREATE OR REPLACE FUNCTION public.current_auto_parts_staff_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session_token TEXT;
  v_staff_id UUID;
BEGIN
  v_session_token := current_setting('request.headers', true)::json ->> 'x-staff-session-token';
  IF v_session_token IS NULL OR v_session_token = '' THEN
    RETURN NULL;
  END IF;
  SELECT staff_id INTO v_staff_id
  FROM public.auto_parts_staff_sessions
  WHERE session_token = v_session_token AND expires_at > now();
  RETURN v_staff_id;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260710: returns feature applied';
END $$;
