-- Re-grant execute on get_employee_pos_bundle to fix 403 error
GRANT EXECUTE ON FUNCTION public.get_employee_pos_bundle(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_employee_session(TEXT) TO anon, authenticated;

-- Function to delete a salon sale with an Admin PIN
CREATE OR REPLACE FUNCTION public.delete_salon_sale_with_pin(
  p_sale_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sale RECORD;
  v_admin RECORD;
  v_item RECORD;
BEGIN
  -- 1. Find the sale
  SELECT * INTO v_sale FROM public.salon_sales WHERE id = p_sale_id LIMIT 1;
  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable.');
  END IF;

  -- 2. Check if a valid admin PIN was provided for this branch
  SELECT * INTO v_admin 
  FROM public.salon_employees 
  WHERE branch_id = v_sale.branch_id 
    AND role = 'admin' 
    AND is_active = true
    AND password_hash IS NOT NULL 
    AND password_hash = crypt(p_pin, password_hash)
  LIMIT 1;

  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code PIN administrateur incorrect ou non autorisé.');
  END IF;

  -- 3. Reverse customer stats
  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.salon_customers
    SET total_spent = GREATEST(0, total_spent - (v_sale.total_amount - COALESCE(v_sale.return_amount, 0))),
        total_visits = GREATEST(0, total_visits - 1)
    WHERE id = v_sale.customer_id;
  END IF;

  -- 4. Reverse inventory movements for products
  FOR v_item IN SELECT * FROM public.salon_sale_items WHERE sale_id = v_sale.id AND product_id IS NOT NULL LOOP
    -- Re-add to inventory by creating an "in" movement
    INSERT INTO public.salon_inventory_movements (
      branch_id, product_id, type, quantity, reason
    ) VALUES (
      v_sale.branch_id, v_item.product_id, 'in', v_item.quantity, 'Annulation de vente (Fiche supprimée)'
    );

    -- Restore stock in salon_products
    UPDATE public.salon_products
    SET quantity_in_stock = quantity_in_stock + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- 5. Delete the sale items
  DELETE FROM public.salon_sale_items WHERE sale_id = v_sale.id;

  -- 6. Delete the sale (this cascades to any payments if foreign keys are set up)
  DELETE FROM public.salon_sales WHERE id = v_sale.id;

  -- 7. (Optional) Delete commissions if the commission module is active
  IF to_regclass('public.commission_transactions') IS NOT NULL THEN
    DELETE FROM public.commission_transactions WHERE sale_id = v_sale.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_salon_sale_with_pin(UUID, TEXT) TO anon, authenticated;
