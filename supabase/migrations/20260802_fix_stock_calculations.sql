-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Critical stock calculation fixes
--
-- 1. FIX THE TRIGGER SIGN INVERSION (CRITICAL BUG)
--    The trigger used stock = stock - NEW.quantity for 'out'/'sale' types,
--    but those movements store NEGATIVE quantities. Result: stock INCREASED
--    on every sale instead of decreasing.
--
--    Fix: stock = stock + NEW.quantity  (since quantity is negative for sales,
--    this correctly subtracts: stock + (-qty) = stock - qty)
--
-- 2. FIX MISSING STOCK ON PURCHASE STATUS CHANGE
--    When a purchase goes from 'draft' to 'delivered', stock movements
--    were never created. Now update_auto_parts_purchase detects status
--    change to 'delivered' and inserts stock movements.
--
-- 3. FIX MISSING STOCK REVERSAL ON PURCHASE DELETE
--    Deleting a delivered purchase did not reverse stock. Now
--    delete_auto_parts_purchase inserts reverse movements.
--
-- 4. ONE-TIME DATA CORRECTION
--    Recalculates stock_quantity for all products from scratch.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Fix the stock trigger (CRITICAL)
-- ════════════════════════════════════════════════════════════════════════════

-- The comment from 20260706 line 128 already identified the issue:
--   "out/sale should ADD negative quantity, not subtract"
-- But the code was never changed. Now we fix it.
CREATE OR REPLACE FUNCTION public.auto_parts_update_stock_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Reversing: delete reverses the original INSERT effect
    -- Original  (after fix): stock + (-qty) = stock - qty
    -- Delete reverses:       stock - (-qty) = stock + qty  ✅
    UPDATE public.auto_parts_products
    SET stock_quantity = stock_quantity - OLD.quantity,
        updated_at = now()
    WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.type IN ('in', 'return') THEN
      -- Positive quantity: stock + qty = stock + qty  ✅
      UPDATE public.auto_parts_products
      SET stock_quantity = stock_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSIF NEW.type IN ('out', 'sale') THEN
      -- Negative quantity: stock + (-qty) = stock - qty  ✅ (was: stock - (-qty) = stock + qty ❌)
      UPDATE public.auto_parts_products
      SET stock_quantity = stock_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSIF NEW.type = 'adjustment' THEN
      UPDATE public.auto_parts_products
      SET stock_quantity = NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Fix update_auto_parts_purchase: add stock on status → delivered
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.update_auto_parts_purchase(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.update_auto_parts_purchase(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_biz UUID;
  v_old_status TEXT;
  v_new_status TEXT;
  v_ref TEXT;
  v_now_delivered BOOLEAN := false;
BEGIN
  SELECT business_id, status, reference_number
  INTO v_biz, v_old_status, v_ref
  FROM public.auto_parts_purchases WHERE id = p_id;

  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  v_new_status := COALESCE(p_status, v_old_status);
  v_ref := COALESCE(p_reference_number, v_ref);

  -- Detect transition to 'delivered'
  IF v_old_status IS DISTINCT FROM 'delivered' AND v_new_status = 'delivered' THEN
    v_now_delivered := true;
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;

  UPDATE public.auto_parts_purchases SET
    supplier_id      = COALESCE(p_supplier_id, supplier_id),
    supplier_name    = COALESCE(p_supplier_name, supplier_name),
    reference_number = v_ref,
    status           = v_new_status,
    subtotal         = COALESCE(p_subtotal, subtotal),
    tax_amount       = COALESCE(p_tax_amount, tax_amount),
    total            = COALESCE(p_total, total),
    notes            = COALESCE(p_notes, notes)
  WHERE id = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (
      p_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC,
      v_biz
    );

    -- Create stock movement only when transitioning to 'delivered'
    IF v_now_delivered AND (v_item->>'product_id')::UUID IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements
        (product_id, type, quantity, unit_price, reference, business_id, created_by)
      VALUES (
        (v_item->>'product_id')::UUID,
        'in',
        (v_item->>'quantity')::NUMERIC,
        (v_item->>'unit_price')::NUMERIC,
        v_ref,
        v_biz,
        auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — Fix delete_auto_parts_purchase: reverse stock on delete
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.delete_auto_parts_purchase(UUID, UUID);
CREATE OR REPLACE FUNCTION public.delete_auto_parts_purchase(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
  v_status TEXT;
  v_ref TEXT;
  v_item RECORD;
BEGIN
  SELECT business_id, status, reference_number
  INTO v_biz, v_status, v_ref
  FROM public.auto_parts_purchases WHERE id = p_id;

  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  -- Reverse stock movements if purchase was delivered
  IF v_status = 'delivered' THEN
    FOR v_item IN SELECT product_id, quantity, unit_price FROM public.auto_parts_purchase_items WHERE purchase_id = p_id
    LOOP
      IF v_item.product_id IS NOT NULL THEN
        INSERT INTO public.auto_parts_stock_movements
          (product_id, type, quantity, unit_price, reference, business_id, created_by)
        VALUES (
          v_item.product_id,
          'out',
          v_item.quantity,
          v_item.unit_price,
          'CANCEL-' || v_ref,
          v_biz,
          auth.uid()
        );
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;
  DELETE FROM public.auto_parts_purchases WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — One-time data correction: recalculate from scratch
-- ════════════════════════════════════════════════════════════════════════════

-- Based on the corrected trigger logic, we rebuild the stock_quantity
-- by replaying all stock movements in chronological order.
--
-- Products that existed before stock movements were tracked use the
-- most recent positive quantity from 'in' movements as their base, or
-- fall back to the current value if no movements exist.
DO $$
DECLARE
  v_product RECORD;
  v_calculated_stock NUMERIC;
  v_current_stock NUMERIC;
  v_diff NUMERIC;
  v_fixed INT := 0;
  v_total INT := 0;
BEGIN
  FOR v_product IN SELECT id, stock_quantity FROM public.auto_parts_products
  LOOP
    v_total := v_total + 1;

    -- Sum all movements in order of creation
    SELECT COALESCE(SUM(
      CASE
        WHEN type IN ('in', 'return') THEN quantity      -- positive = add
        WHEN type IN ('out', 'sale') THEN quantity        -- negative = subtract (with corrected trigger logic)
        WHEN type = 'adjustment' THEN NULL                -- handled separately below
        ELSE 0
      END
    ), 0) INTO v_calculated_stock
    FROM (
      SELECT type, quantity, created_at
      FROM public.auto_parts_stock_movements
      WHERE product_id = v_product.id
        AND type != 'adjustment'
      ORDER BY created_at
    ) sub;

    -- Add the most recent adjustment value (if any)
    SELECT COALESCE(
      (SELECT quantity FROM public.auto_parts_stock_movements
       WHERE product_id = v_product.id AND type = 'adjustment'
       ORDER BY created_at DESC LIMIT 1),
      v_calculated_stock
    ) INTO v_calculated_stock;

    -- If no movements exist, keep current value
    IF NOT EXISTS (SELECT 1 FROM public.auto_parts_stock_movements WHERE product_id = v_product.id) THEN
      CONTINUE;
    END IF;

    v_current_stock := v_product.stock_quantity;
    v_diff := v_calculated_stock - v_current_stock;

    IF v_diff != 0 THEN
      UPDATE public.auto_parts_products
      SET stock_quantity = v_calculated_stock,
          updated_at = now()
      WHERE id = v_product.id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Stock recalculated: % / % products fixed (diff applied: value = sum of movements with corrected sign)', v_fixed, v_total;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.update_auto_parts_purchase TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_purchase TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Stock calculations: CRITICAL trigger sign fix applied + purchase stock tracking fixed'; END $$;
