-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — Unified return / refund infrastructure
-- Date: 2026-07-12
--
-- 1. Adds refund columns to salon_sales, bar_sales
-- 2. Adds returned_quantity to salon_sale_items, bar_sale_items
-- 3. Adds 'return' to salon_stock_movements movement_type
-- 4. Adds 'RETOUR_CLIENT' to bar_movement_type enum
-- 5. Adds return_amount to auto_parts_sales
-- 6. Creates process_salon_return() RPC
-- 7. Creates salon_list_returns() RPC
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. SALON: refund columns on sales ───
ALTER TABLE public.salon_sales
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'partial', 'full')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_amount DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- ─── 2. SALON: returned quantity on sale items ───
ALTER TABLE public.salon_sale_items
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

-- ─── 3. SALON: allow 'return' movement type ───
ALTER TABLE public.salon_stock_movements
  DROP CONSTRAINT IF EXISTS salon_stock_movements_movement_type_check;

ALTER TABLE public.salon_stock_movements
  ADD CONSTRAINT salon_stock_movements_movement_type_check
    CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'loss', 'audit', 'return'));

-- ─── 4. BAR: refund columns on sales ───
ALTER TABLE public.bar_sales
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'partial', 'full')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- ─── 5. BAR: returned quantity on sale items ───
ALTER TABLE public.bar_sale_items
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER NOT NULL DEFAULT 0;

-- ─── 6. BAR: add 'RETOUR_CLIENT' to movement type enum ───
DO $$ BEGIN
  ALTER TYPE public.bar_movement_type ADD VALUE IF NOT EXISTS 'RETOUR_CLIENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 7. AUTO PARTS: add return_amount column ───
ALTER TABLE public.auto_parts_sales
  ADD COLUMN IF NOT EXISTS return_amount DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- ─── 8. SALON: process return RPC ───
CREATE OR REPLACE FUNCTION public.process_salon_return(
  p_business_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_total_return_amount NUMERIC := 0;
  v_total_sold_qty INTEGER := 0;
  v_total_return_qty INTEGER := 0;
  v_staff_id UUID;
BEGIN
  -- Validate sale exists and belongs to this business
  SELECT * INTO v_sale
  FROM public.salon_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  IF v_sale.branch_id <> p_branch_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'La vente n''appartient pas à cette branche');
  END IF;

  v_staff_id := COALESCE(p_cashier_id, auth.uid());

  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_total_return_qty := v_total_return_qty + v_quantity;
    v_total_return_amount := v_total_return_amount + (v_quantity * v_unit_price);

    -- Record stock movement (positive delta = stock goes back in)
    INSERT INTO public.salon_stock_movements
      (business_id, branch_id, product_id, movement_type, quantity_delta, reason, reference_id, created_by)
    VALUES
      (p_business_id, p_branch_id, v_product_id, 'return', v_quantity, COALESCE(p_reason, 'Retour client'), p_sale_id, v_staff_id);

    -- Restore product stock
    UPDATE public.salon_products
    SET quantity_in_stock = quantity_in_stock + v_quantity,
        updated_at = now()
    WHERE id = v_product_id AND branch_id = p_branch_id;

    -- Mark returned quantity on sale item
    UPDATE public.salon_sale_items
    SET returned_quantity = returned_quantity + v_quantity
    WHERE sale_id = p_sale_id AND product_id = v_product_id;
  END LOOP;

  -- Compute total sold quantity for this sale
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.salon_sale_items
  WHERE sale_id = p_sale_id;

  -- Update refund_status and return_amount
  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.salon_sales
    SET refund_status = 'full',
        refunded_at = now(),
        return_amount = return_amount + v_total_return_amount
    WHERE id = p_sale_id;
  ELSE
    UPDATE public.salon_sales
    SET refund_status = 'partial',
        refunded_at = now(),
        return_amount = return_amount + v_total_return_amount
    WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'refund_status', CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END,
    'return_amount', v_total_return_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_salon_return(UUID, UUID, UUID, JSONB, TEXT, UUID) TO anon, authenticated;

-- ─── 9. SALON: list returns (stock movements of type 'return') ───
CREATE OR REPLACE FUNCTION public.salon_list_returns(
  p_business_id UUID,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(sm) || jsonb_build_object(
        'product', CASE WHEN sm.product_id IS NOT NULL THEN
          (SELECT to_jsonb(pr) FROM (SELECT p.id, p.name FROM public.salon_products p WHERE p.id = sm.product_id) pr)
        ELSE NULL END,
        'sale', CASE WHEN sm.reference_id IS NOT NULL THEN
          (SELECT to_jsonb(s) FROM (
            SELECT s.id, s.sale_number, s.total_amount, s.refund_status, s.refunded_at, s.customer_name
            FROM public.salon_sales s WHERE s.id = sm.reference_id
          ) s)
        ELSE NULL END
      )
      ORDER BY sm.created_at DESC
    ), '[]'::jsonb)
    FROM public.salon_stock_movements sm
    WHERE sm.business_id = p_business_id
      AND sm.movement_type = 'return'
      AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
    LIMIT 200
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salon_list_returns(UUID, UUID) TO anon, authenticated;

DO $$ BEGIN
  RAISE NOTICE 'Migration 20260712: unified return infrastructure applied';
END $$;
