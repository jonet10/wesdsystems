-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Cashier Dashboard, Invoice Status & Return Workflow
-- Migration: 20260810_cashier_invoice_return_workflow.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Add status column to auto_parts_sales ───────────────────────────
ALTER TABLE public.auto_parts_sales
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'RETURNED', 'CANCELLED'));

-- Backfill existing rows:
-- If refund_status = 'full' → RETURNED, else ACTIVE
UPDATE public.auto_parts_sales
  SET status = CASE WHEN refund_status = 'full' THEN 'RETURNED' ELSE 'ACTIVE' END
  WHERE status = 'ACTIVE';

-- ─── PART 2: Return Request tables ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auto_parts_return_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  sale_id         UUID NOT NULL REFERENCES public.auto_parts_sales(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL,
  staff_id        UUID REFERENCES public.auto_parts_staff(id) ON DELETE SET NULL,
  staff_name      TEXT,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'EN_ATTENTE'
                    CHECK (status IN ('EN_ATTENTE', 'APPROUVE', 'REFUSE')),
  reviewed_by     UUID REFERENCES public.auto_parts_staff(id) ON DELETE SET NULL,
  reviewer_name   TEXT,
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_parts_return_request_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES public.auto_parts_return_requests(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.auto_parts_products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,
  quantity        NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_business ON public.auto_parts_return_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_sale ON public.auto_parts_return_requests(sale_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_staff ON public.auto_parts_return_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.auto_parts_return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_request_items ON public.auto_parts_return_request_items(request_id);

-- ─── PART 3: RPC — create_auto_parts_return_request ─────────────────────────
DROP FUNCTION IF EXISTS public.create_auto_parts_return_request(UUID, UUID, UUID, TEXT, JSONB);
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

  -- Resolve staff name
  SELECT name INTO v_staff_name FROM public.auto_parts_staff WHERE id = p_staff_id;

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

-- ─── PART 4: RPC — approve_auto_parts_return ─────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_auto_parts_return(UUID, UUID);
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

  SELECT name INTO v_reviewer_name FROM public.auto_parts_staff WHERE id = p_reviewer_id;

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

  -- Compute total sold qty
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.auto_parts_sale_items WHERE sale_id = v_request.sale_id;

  -- Update sale status & refund_status
  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.auto_parts_sales
      SET refund_status = 'full', refunded_at = now(), status = 'RETURNED'
      WHERE id = v_request.sale_id;
  ELSE
    UPDATE public.auto_parts_sales
      SET refund_status = 'partial', refunded_at = now()
      WHERE id = v_request.sale_id;
  END IF;

  -- Mark request approved
  UPDATE public.auto_parts_return_requests
    SET status = 'APPROUVE', reviewed_by = p_reviewer_id,
        reviewer_name = v_reviewer_name, reviewed_at = now()
    WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'refund_status',
    CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END);
END;
$$;

-- ─── PART 5: RPC — reject_auto_parts_return ──────────────────────────────────
DROP FUNCTION IF EXISTS public.reject_auto_parts_return(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.reject_auto_parts_return(
  p_request_id       UUID,
  p_reviewer_id      UUID DEFAULT NULL,
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

  SELECT name INTO v_reviewer_name FROM public.auto_parts_staff WHERE id = p_reviewer_id;

  UPDATE public.auto_parts_return_requests
    SET status = 'REFUSE', reviewed_by = p_reviewer_id,
        reviewer_name = v_reviewer_name, reviewed_at = now(),
        rejection_reason = p_rejection_reason
    WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'status', 'REFUSE');
END;
$$;

-- ─── PART 6: RPC — auto_parts_list_return_requests ──────────────────────────
DROP FUNCTION IF EXISTS public.auto_parts_list_return_requests(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_list_return_requests(
  p_business_id UUID,
  p_staff_id    UUID DEFAULT NULL,
  p_status      TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'items', COALESCE(
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at)
           FROM public.auto_parts_return_request_items i WHERE i.request_id = r.id),
          '[]'::jsonb
        )
      )
      ORDER BY r.created_at DESC
    ), '[]'::jsonb)
    FROM public.auto_parts_return_requests r
    WHERE r.business_id = p_business_id
      AND (p_staff_id IS NULL OR r.staff_id = p_staff_id)
      AND (p_status IS NULL OR r.status = p_status)
    LIMIT 200
  );
END;
$$;

-- ─── PART 7: RPC — auto_parts_cashier_dashboard ─────────────────────────────
-- Returns stats for ONE cashier only (no revenue for cashier view)
DROP FUNCTION IF EXISTS public.auto_parts_cashier_dashboard(UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_dashboard(
  p_business_id UUID,
  p_staff_id    UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start    TIMESTAMPTZ := date_trunc('day', now());
  v_week_start   TIMESTAMPTZ := date_trunc('week', now());
  v_month_start  TIMESTAMPTZ := date_trunc('month', now());
  v_sales_today  INT := 0;
  v_sales_week   INT := 0;
  v_sales_month  INT := 0;
  v_inv_today    INT := 0;
  v_inv_week     INT := 0;
  v_inv_month    INT := 0;
  v_items_today  NUMERIC := 0;
  v_items_week   NUMERIC := 0;
  v_items_month  NUMERIC := 0;
BEGIN
  -- Sales counts (number of transactions)
  SELECT COUNT(*) INTO v_sales_today FROM public.auto_parts_sales
    WHERE business_id = p_business_id AND staff_id = p_staff_id
      AND created_at >= v_day_start AND status = 'ACTIVE'
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_sales_week FROM public.auto_parts_sales
    WHERE business_id = p_business_id AND staff_id = p_staff_id
      AND created_at >= v_week_start AND status = 'ACTIVE'
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_sales_month FROM public.auto_parts_sales
    WHERE business_id = p_business_id AND staff_id = p_staff_id
      AND created_at >= v_month_start AND status = 'ACTIVE'
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  -- Invoice counts (same as sales in this model)
  v_inv_today  := v_sales_today;
  v_inv_week   := v_sales_week;
  v_inv_month  := v_sales_month;

  -- Products sold (sum of quantities)
  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_today
    FROM public.auto_parts_sales s
    JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
    WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
      AND s.created_at >= v_day_start AND s.status = 'ACTIVE'
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_week
    FROM public.auto_parts_sales s
    JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
    WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
      AND s.created_at >= v_week_start AND s.status = 'ACTIVE'
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_month
    FROM public.auto_parts_sales s
    JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
    WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
      AND s.created_at >= v_month_start AND s.status = 'ACTIVE'
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'salesToday',   v_sales_today,
    'salesWeek',    v_sales_week,
    'salesMonth',   v_sales_month,
    'invoicesToday', v_inv_today,
    'invoicesWeek',  v_inv_week,
    'invoicesMonth', v_inv_month,
    'itemsSoldToday', v_items_today,
    'itemsSoldWeek',  v_items_week,
    'itemsSoldMonth', v_items_month
  );
END;
$$;

-- ─── PART 8: RPC — auto_parts_admin_cashier_stats ────────────────────────────
-- Global view + breakdown by cashier for admin
DROP FUNCTION IF EXISTS public.auto_parts_admin_cashier_stats(UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_admin_cashier_stats(
  p_business_id UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start   TIMESTAMPTZ := date_trunc('day', now());
  v_week_start  TIMESTAMPTZ := date_trunc('week', now());
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_global      JSONB;
  v_by_cashier  JSONB;
BEGIN
  -- Global stats
  SELECT jsonb_build_object(
    'salesToday',    COALESCE(SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END), 0),
    'salesWeek',     COALESCE(SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END), 0),
    'salesMonth',    COALESCE(SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END), 0),
    'invoicesToday', COUNT(CASE WHEN s.created_at >= v_day_start   THEN 1 END),
    'invoicesWeek',  COUNT(CASE WHEN s.created_at >= v_week_start  THEN 1 END),
    'invoicesMonth', COUNT(CASE WHEN s.created_at >= v_month_start THEN 1 END)
  ) INTO v_global
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id AND s.status = 'ACTIVE'
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  -- By cashier
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'staffId',       COALESCE(s.staff_id::TEXT, 'unknown'),
    'staffName',     COALESCE(s.staff_name, 'Non assigné'),
    'salesToday',    COALESCE(SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END), 0),
    'salesWeek',     COALESCE(SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END), 0),
    'salesMonth',    COALESCE(SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END), 0),
    'invoicesTotal', COUNT(*)
  ) ORDER BY SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END) DESC
  ), '[]'::jsonb) INTO v_by_cashier
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id AND s.status = 'ACTIVE'
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
  GROUP BY s.staff_id, s.staff_name;

  RETURN jsonb_build_object('global', v_global, 'byCashier', v_by_cashier);
END;
$$;

-- ─── PART 9: Update auto_parts_list_sales to accept p_staff_id filter ────────
DROP FUNCTION IF EXISTS public.auto_parts_list_sales(UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_sales(
  p_business_id UUID,
  p_branch_id   UUID DEFAULT NULL,
  p_staff_id    UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    to_jsonb(s) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
        FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
    )
    ORDER BY s.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
    AND (p_staff_id IS NULL OR s.staff_id = p_staff_id)
  LIMIT 100;
  RETURN v_result;
END;
$$;

-- ─── GRANTS ───────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.create_auto_parts_return_request TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_auto_parts_return TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_auto_parts_return TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_return_requests TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_dashboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_admin_cashier_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_sales(UUID, UUID, UUID) TO anon, authenticated;

-- RLS — allow business members to see their own return requests
ALTER TABLE public.auto_parts_return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_parts_return_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_requests_business_isolation" ON public.auto_parts_return_requests;
CREATE POLICY "return_requests_business_isolation"
  ON public.auto_parts_return_requests FOR ALL
  USING (true) WITH CHECK (true); -- SECURITY DEFINER RPCs handle isolation

DROP POLICY IF EXISTS "return_request_items_isolation" ON public.auto_parts_return_request_items;
CREATE POLICY "return_request_items_isolation"
  ON public.auto_parts_return_request_items FOR ALL
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN RAISE NOTICE 'Migration 20260810 applied: cashier dashboard + invoice status + return workflow'; END $$;
