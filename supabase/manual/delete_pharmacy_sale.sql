-- ============================================================================
-- SUPPRESSION MANUELLE D'UNE VENTE DE PHARMACIE
-- À exécuter dans Supabase > SQL Editor (rôle service / postgres).
--
-- La suppression :
--   * restaure les quantités dans les lots (pharmacy_batches),
--   * supprime les mouvements de stock liés à la vente,
--   * supprime la vente (lignes et crédits liés en cascade),
--   * recalcule le rapprochement d'une caisse déjà fermée.
--
-- Le trigger pharmacy_update_product_stock() recalcule automatiquement
-- pharmacy_products.total_stock_quantity après la restauration des lots.
-- ============================================================================

-- 1) Repérer la vente à supprimer (les plus récentes d'abord).
SELECT
  id,
  receipt_number,
  created_at,
  total,
  payment_method,
  payment_status,
  register_id
FROM public.pharmacy_sales
ORDER BY created_at DESC
LIMIT 50;

-- 2) Vérifier les lignes et les lots qui seront restaurés.
--    Remplacez <SALE_ID> par l'UUID trouvé à l'étape 1.
-- SELECT
--   si.id,
--   si.product_id,
--   p.name AS product_name,
--   si.batch_id,
--   b.batch_number,
--   si.quantity,
--   b.current_quantity AS batch_stock_actuel
-- FROM public.pharmacy_sale_items si
-- LEFT JOIN public.pharmacy_products p ON p.id = si.product_id
-- LEFT JOIN public.pharmacy_batches b ON b.id = si.batch_id
-- WHERE si.sale_id = '<SALE_ID>';

-- 3) Supprimer la vente.
--    Remplacez <SALE_ID> par l'UUID de la vente, puis exécutez tout le bloc.
BEGIN;

DO $$
DECLARE
  v_sale_id UUID := '<SALE_ID>';
  v_sale public.pharmacy_sales%ROWTYPE;
  v_item RECORD;
  v_expected NUMERIC;
BEGIN
  SELECT * INTO v_sale
  FROM public.pharmacy_sales
  WHERE id = v_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable : %', v_sale_id;
  END IF;

  -- Restaurer les quantités dans les lots utilisés par la vente.
  FOR v_item IN
    SELECT batch_id, quantity
    FROM public.pharmacy_sale_items
    WHERE sale_id = v_sale_id
      AND batch_id IS NOT NULL
  LOOP
    UPDATE public.pharmacy_batches
    SET current_quantity = COALESCE(current_quantity, 0) + v_item.quantity
    WHERE id = v_item.batch_id;
  END LOOP;

  -- Supprimer les mouvements de stock générés par la vente.
  DELETE FROM public.pharmacy_stock_movements
  WHERE business_id = v_sale.business_id
    AND type = 'sale'
    AND reference = 'Sale ' || v_sale.receipt_number;

  -- Supprimer la vente (sale_items et crédits liés suivent en cascade).
  DELETE FROM public.pharmacy_sales WHERE id = v_sale_id;

  -- Recalculer le rapprochement si la caisse est déjà fermée.
  IF v_sale.register_id IS NOT NULL THEN
    SELECT
      COALESCE(r.initial_amount, 0)
      + COALESCE((
          SELECT SUM(s.total)
          FROM public.pharmacy_sales s
          WHERE s.register_id = r.id
            AND s.payment_method = 'cash'
            AND s.payment_status = 'paid'
        ), 0)
      - COALESCE((
          SELECT SUM(e.amount)
          FROM public.pharmacy_expenses e
          WHERE e.register_id = r.id
        ), 0)
    INTO v_expected
    FROM public.pharmacy_cash_registers r
    WHERE r.id = v_sale.register_id;

    UPDATE public.pharmacy_cash_registers
    SET expected_amount = v_expected,
        difference = CASE
          WHEN actual_amount IS NULL THEN NULL
          ELSE actual_amount - v_expected
        END
    WHERE id = v_sale.register_id
      AND status = 'closed';
  END IF;

  RAISE NOTICE 'Vente % supprimée, stock restauré.', v_sale.receipt_number;
END $$;

-- Vérifiez le message, puis validez la transaction.
COMMIT;

-- En cas de problème, utilisez plutôt :
-- ROLLBACK;
