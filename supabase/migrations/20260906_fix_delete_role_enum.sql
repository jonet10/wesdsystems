CREATE OR REPLACE FUNCTION public.delete_salon_sale_with_pin(
  p_sale_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $body
DECLARE
  v_sale RECORD;
  v_admin RECORD;
  v_item RECORD;
  v_admin_found BOOLEAN := false;
BEGIN
  -- 1. Trouver la vente
  SELECT * INTO v_sale FROM public.salon_sales WHERE id = p_sale_id LIMIT 1;
  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable.');
  END IF;

  -- 2. Verifier si le PIN correspond a un administrateur ou manager
  FOR v_admin IN 
    SELECT * FROM public.salon_employees 
    WHERE branch_id = v_sale.branch_id 
      AND role IN ('owner', 'manager')
      AND is_active = true
      AND password_hash IS NOT NULL
  LOOP
    IF v_admin.password_hash = crypt(p_pin, v_admin.password_hash) THEN
      v_admin_found := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_admin_found THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code PIN manager/owner incorrect ou non autorise.');
  END IF;

  -- 3. Annuler les stats client
  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.salon_customers
    SET total_spent = GREATEST(0, total_spent - (v_sale.total_amount - COALESCE(v_sale.return_amount, 0))),
        total_visits = GREATEST(0, total_visits - 1)
    WHERE id = v_sale.customer_id;
  END IF;

  -- 4. Restituer le stock
  FOR v_item IN SELECT * FROM public.salon_sale_items WHERE sale_id = v_sale.id AND product_id IS NOT NULL LOOP
    INSERT INTO public.salon_inventory_movements (
      branch_id, product_id, type, quantity, reason
    ) VALUES (
      v_sale.branch_id, v_item.product_id, 'in', v_item.quantity, 'Annulation de vente (Fiche supprimee)'
    );

    UPDATE public.salon_products
    SET quantity_in_stock = quantity_in_stock + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  -- 5. Supprimer
  DELETE FROM public.salon_sale_items WHERE sale_id = v_sale.id;
  DELETE FROM public.salon_sales WHERE id = v_sale.id;

  IF to_regclass('public.commission_transactions') IS NOT NULL THEN
    DELETE FROM public.commission_transactions WHERE sale_id = v_sale.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$body;
