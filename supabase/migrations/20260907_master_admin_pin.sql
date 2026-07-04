-- 1. Add admin_pin_hash to businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS admin_pin_hash TEXT;

-- 2. Create function to set admin pin
CREATE OR REPLACE FUNCTION public.set_business_admin_pin(
  p_business_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $body
BEGIN
  -- Verify the user owns the business (RLS equivalent in Security Definer)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND business_id = p_business_id AND role IN ('salon_admin', 'business_owner')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  UPDATE public.businesses
  SET admin_pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_business_id;

  RETURN jsonb_build_object('success', true);
END;
$body;

-- 3. Update delete_salon_sale_with_pin to use businesses.admin_pin_hash
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
  v_branch RECORD;
  v_business RECORD;
  v_item RECORD;
BEGIN
  -- 1. Trouver la vente
  SELECT * INTO v_sale FROM public.salon_sales WHERE id = p_sale_id LIMIT 1;
  IF v_sale.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable.');
  END IF;

  -- 2. Trouver le business via la succursale
  SELECT * INTO v_branch FROM public.salon_branches WHERE id = v_sale.branch_id LIMIT 1;
  SELECT * INTO v_business FROM public.businesses WHERE id = v_branch.business_id LIMIT 1;

  -- 3. Verifier le PIN maitre
  IF v_business.admin_pin_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun Code PIN Maitre configure. Veuillez le definir dans les Parametres.');
  END IF;

  IF v_business.admin_pin_hash != crypt(p_pin, v_business.admin_pin_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code PIN Maitre incorrect.');
  END IF;

  -- 4. Annuler les stats client
  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.salon_customers
    SET total_spent = GREATEST(0, total_spent - (v_sale.total_amount - COALESCE(v_sale.return_amount, 0))),
        total_visits = GREATEST(0, total_visits - 1)
    WHERE id = v_sale.customer_id;
  END IF;

  -- 5. Restituer le stock
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

  -- 6. Supprimer
  DELETE FROM public.salon_sale_items WHERE sale_id = v_sale.id;
  DELETE FROM public.salon_sales WHERE id = v_sale.id;

  IF to_regclass('public.commission_transactions') IS NOT NULL THEN
    DELETE FROM public.commission_transactions WHERE sale_id = v_sale.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$body;
