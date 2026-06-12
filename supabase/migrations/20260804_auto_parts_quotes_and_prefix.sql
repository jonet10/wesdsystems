-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Quotes module + custom invoice prefix
--
-- 1. Quote sequence + number generator
-- 2. auto_parts_quotes table
-- 3. auto_parts_quote_items table
-- 4. CRUD RPCs (create, update, delete, list, get)
-- 5. Update generate_auto_parts_invoice_number to use business prefix
-- 6. Update create_auto_parts_sale with p_invoice_prefix parameter
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Quote sequence & number generator
-- ════════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS public.auto_parts_quote_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_auto_parts_quote_number(p_prefix TEXT DEFAULT 'DEV-')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.auto_parts_quote_seq');
  RETURN p_prefix || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Quotes table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auto_parts_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  client_id UUID REFERENCES public.auto_parts_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,

  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')) DEFAULT 'none',
  discount_value NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'refused', 'converted', 'expired')),
  valid_until DATE,
  notes TEXT,
  terms TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_parts_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.auto_parts_quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.auto_parts_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_parts_quotes_business ON public.auto_parts_quotes(business_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_quotes_number ON public.auto_parts_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_auto_parts_quote_items_quote ON public.auto_parts_quote_items(quote_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.auto_parts_quotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_auto_parts_quotes_updated_at ON public.auto_parts_quotes;
CREATE TRIGGER trg_auto_parts_quotes_updated_at
  BEFORE UPDATE ON public.auto_parts_quotes
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_quotes_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.auto_parts_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_parts_quote_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quotes_business_access' AND tablename = 'auto_parts_quotes') THEN
    CREATE POLICY quotes_business_access ON public.auto_parts_quotes
      FOR ALL USING (
        business_id IN (SELECT b.id FROM public.businesses b JOIN public.profiles p ON p.business_id = b.id WHERE p.id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quote_items_business_access' AND tablename = 'auto_parts_quote_items') THEN
    CREATE POLICY quote_items_business_access ON public.auto_parts_quote_items
      FOR ALL USING (
        business_id IN (SELECT b.id FROM public.businesses b JOIN public.profiles p ON p.business_id = b.id WHERE p.id = auth.uid())
      );
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — CRUD RPCs
-- ════════════════════════════════════════════════════════════════════════════

-- ─── create_auto_parts_quote ───
CREATE OR REPLACE FUNCTION public.create_auto_parts_quote(
  p_business_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax_rate NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_value NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_valid_until DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_quote_prefix TEXT DEFAULT 'DEV-',
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
  v_number TEXT;
  v_item JSONB;
BEGIN
  v_number := generate_auto_parts_quote_number(p_quote_prefix);

  INSERT INTO public.auto_parts_quotes (
    business_id, quote_number, client_id, client_name, client_phone, client_email,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, valid_until, notes, terms, created_by
  ) VALUES (
    p_business_id, v_number, p_client_id, p_client_name, p_client_phone, p_client_email,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_valid_until, p_notes, p_terms, auth.uid()
  ) RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_quote_items (quote_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (
      v_quote_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC,
      p_business_id
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_quote_id, 'quote_number', v_number);
END;
$$;

-- ─── update_auto_parts_quote ───
CREATE OR REPLACE FUNCTION public.update_auto_parts_quote(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT NULL,
  p_tax_rate NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_total NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_valid_until DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_quotes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_quote_items WHERE quote_id = p_id;

  UPDATE public.auto_parts_quotes SET
    client_id       = COALESCE(p_client_id, client_id),
    client_name     = COALESCE(p_client_name, client_name),
    client_phone    = COALESCE(p_client_phone, client_phone),
    client_email    = COALESCE(p_client_email, client_email),
    subtotal        = COALESCE(p_subtotal, subtotal),
    tax_rate        = COALESCE(p_tax_rate, tax_rate),
    tax_amount      = COALESCE(p_tax_amount, tax_amount),
    discount_type   = COALESCE(p_discount_type, discount_type),
    discount_value  = COALESCE(p_discount_value, discount_value),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total           = COALESCE(p_total, total),
    status          = COALESCE(p_status, status),
    valid_until     = COALESCE(p_valid_until, valid_until),
    notes           = COALESCE(p_notes, notes),
    terms           = COALESCE(p_terms, terms)
  WHERE id = p_id;

  INSERT INTO public.auto_parts_quote_items (quote_id, product_id, product_name, quantity, unit_price, total_price, business_id)
  SELECT p_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
         (v_item->>'quantity')::NUMERIC, (v_item->>'unit_price')::NUMERIC,
         (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, v_biz
  FROM jsonb_array_elements(p_items) v_item;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

-- ─── delete_auto_parts_quote ───
CREATE OR REPLACE FUNCTION public.delete_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_quotes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_quote_items WHERE quote_id = p_id;
  DELETE FROM public.auto_parts_quotes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

-- ─── get_auto_parts_quote ───
CREATE OR REPLACE FUNCTION public.get_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT to_jsonb(q) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
      FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_quotes q
  WHERE q.id = p_id AND (q.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;

-- ─── list_auto_parts_quotes ───
CREATE OR REPLACE FUNCTION public.list_auto_parts_quotes(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(q) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
        FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
    )
    ORDER BY q.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_quotes q
  WHERE q.business_id = p_business_id OR q.business_id IS NULL
  LIMIT 100;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — Update invoice number generator to support custom prefix
-- ════════════════════════════════════════════════════════════════════════════

-- New version: accepts business_id to read prefix from settings
DROP FUNCTION IF EXISTS public.generate_auto_parts_invoice_number();
CREATE OR REPLACE FUNCTION public.generate_auto_parts_invoice_number(p_business_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
  v_prefix TEXT := 'INV-';
BEGIN
  IF p_business_id IS NOT NULL THEN
    SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id;
  END IF;
  next_val := nextval('public.auto_parts_invoice_seq');
  RETURN v_prefix || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 5 — Update create_auto_parts_sale with prefix support
-- ════════════════════════════════════════════════════════════════════════════

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
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_status TEXT DEFAULT 'paid',
  p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT NULL,
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
  v_staff_name TEXT;
  v_prefix TEXT;
BEGIN
  -- Resolve prefix: passed value > business settings > default
  IF p_invoice_prefix IS NOT NULL THEN
    v_prefix := p_invoice_prefix;
  ELSE
    SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id;
    IF v_prefix IS NULL THEN v_prefix := 'INV-'; END IF;
  END IF;

  v_invoice := generate_auto_parts_invoice_number(p_business_id);
  v_staff_name := (SELECT name FROM public.auto_parts_staff WHERE id = p_staff_id);

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_payment_method, p_payment_status, p_notes, p_staff_id, v_staff_name
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO public.auto_parts_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, business_id, created_by)
      VALUES (v_product_id, 'sale', -v_quantity, v_unit_price, v_invoice, p_business_id, auth.uid());
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object('id', s.id, 'invoice_number', s.invoice_number, 'total', s.total)
    FROM public.auto_parts_sales s WHERE s.id = v_sale_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_auto_parts_invoice_number TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_auto_parts_quote_number TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_quote TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_quote TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_quote TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_quote TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_quotes TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260804 applied: quotes module + dynamic invoice prefix'; END $$;
