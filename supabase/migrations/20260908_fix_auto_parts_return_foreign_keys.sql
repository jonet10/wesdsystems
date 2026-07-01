-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260908: Fix Auto-Parts Return requests foreign key and resolution
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Supprimer les contraintes de clés étrangères restrictives sur auto_parts_return_requests
ALTER TABLE public.auto_parts_return_requests
  DROP CONSTRAINT IF EXISTS auto_parts_return_requests_staff_id_fkey,
  DROP CONSTRAINT IF EXISTS auto_parts_return_requests_reviewed_by_fkey;

-- 2. Mettre à jour la fonction de création de demande de retour
CREATE OR REPLACE FUNCTION public.create_auto_parts_return_request(
  p_business_id UUID,
  p_sale_id     UUID,
  p_staff_id    UUID DEFAULT NULL,
  p_reason      TEXT DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale        RECORD;
  v_request_id  UUID;
  v_staff_name  TEXT;
  v_item        JSONB;
BEGIN
  -- Validate sale
  SELECT * INTO v_sale
  FROM public.auto_parts_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  IF v_sale.status = 'RETURNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette facture a déjà été retournée intégralement');
  END IF;

  -- Resolve staff name (try auto_parts_staff first, fallback to profiles for admins/owners)
  SELECT name INTO v_staff_name FROM public.auto_parts_staff WHERE id = p_staff_id;
  IF v_staff_name IS NULL AND p_staff_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_staff_name FROM public.profiles WHERE id = p_staff_id;
  END IF;

  -- Create request
  INSERT INTO public.auto_parts_return_requests
    (business_id, branch_id, sale_id, invoice_number, staff_id, staff_name, reason, status)
  VALUES
    (p_business_id, v_sale.branch_id, p_sale_id, v_sale.invoice_number, p_staff_id, v_staff_name, p_reason, 'EN_ATTENTE')
  RETURNING id INTO v_request_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_return_request_items
      (request_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_request_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      COALESCE((v_item->>'unit_price')::NUMERIC, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'EN_ATTENTE'
  );
END;
$$;

-- 3. Mettre à jour la fonction d'approbation de retour
CREATE OR REPLACE FUNCTION public.approve_auto_parts_return(
  p_request_id  UUID,
  p_reviewer_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request         RECORD;
  v_item            RECORD;
  v_total_return_qty NUMERIC := 0;
  v_total_sold_qty   NUMERIC := 0;
  v_reviewer_name   TEXT;
BEGIN
  -- Load request
  SELECT * INTO v_request
  FROM public.auto_parts_return_requests
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable');
  END IF;

  IF v_request.status != 'EN_ATTENTE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande a déjà été traitée');
  END IF;

  -- Resolve reviewer name (try auto_parts_staff, fallback to profiles for admins)
  SELECT name INTO v_reviewer_name FROM public.auto_parts_staff WHERE id = p_reviewer_id;
  IF v_reviewer_name IS NULL AND p_reviewer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_reviewer_name FROM public.profiles WHERE id = p_reviewer_id;
  END IF;

  -- Process each item: restock + record stock movement
  FOR v_item IN
    SELECT * FROM public.auto_parts_return_request_items WHERE request_id = p_request_id
  LOOP
    v_total_return_qty := v_total_return_qty + v_item.quantity;

    -- Restock product
    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.auto_parts_products
        SET stock_quantity = stock_quantity + v_item.quantity
        WHERE id = v_item.product_id AND business_id = v_request.business_id;

      -- Record movement
      INSERT INTO public.auto_parts_stock_movements
        (product_id, type, quantity, unit_price, reference, notes, business_id, branch_id)
      VALUES (
        v_item.product_id, 'return', v_item.quantity, v_item.unit_price,
        v_request.invoice_number,
        COALESCE(v_request.reason, 'Retour approuvé'),
        v_request.business_id, v_request.branch_id
      );
    END IF;
  END LOOP;

  -- Update request status
  UPDATE public.auto_parts_return_requests
    SET status = 'APPROUVE', reviewed_by = p_reviewer_id,
        reviewer_name = v_reviewer_name, reviewed_at = now()
    WHERE id = p_request_id;

  -- Update sale status (check if fully or partially returned)
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
    FROM public.auto_parts_sale_items WHERE sale_id = v_request.sale_id;

  -- If total returned matches total sold, mark sale as returned
  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.auto_parts_sales SET refund_status = 'full', status = 'RETURNED' WHERE id = v_request.sale_id;
  ELSE
    UPDATE public.auto_parts_sales SET refund_status = 'partial' WHERE id = v_request.sale_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'APPROUVE');
END;
$$;

-- 4. Mettre à jour la fonction de rejet de retour
CREATE OR REPLACE FUNCTION public.reject_auto_parts_return(
  p_request_id  UUID,
  p_reviewer_id UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request       RECORD;
  v_reviewer_name TEXT;
BEGIN
  SELECT * INTO v_request FROM public.auto_parts_return_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable');
  END IF;

  IF v_request.status != 'EN_ATTENTE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande a déjà été traitée');
  END IF;

  -- Resolve reviewer name (try auto_parts_staff, fallback to profiles for admins)
  SELECT name INTO v_reviewer_name FROM public.auto_parts_staff WHERE id = p_reviewer_id;
  IF v_reviewer_name IS NULL AND p_reviewer_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_reviewer_name FROM public.profiles WHERE id = p_reviewer_id;
  END IF;

  UPDATE public.auto_parts_return_requests
    SET status = 'REFUSE', reviewed_by = p_reviewer_id,
        reviewer_name = v_reviewer_name, reviewed_at = now(),
        rejection_reason = p_rejection_reason
    WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'REFUSE');
END;
$$;
