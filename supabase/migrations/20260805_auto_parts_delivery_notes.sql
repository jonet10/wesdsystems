-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Delivery notes module
--
-- Bons de livraison : linked to sales or standalone
-- 1. Sequence + number generator (uses delivery_note_prefix from settings)
-- 2. auto_parts_delivery_notes table
-- 3. auto_parts_delivery_note_items table
-- 4. CRUD RPCs
-- ════════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS public.auto_parts_delivery_note_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_auto_parts_delivery_note_number(p_prefix TEXT DEFAULT 'BL-')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE next_val BIGINT;
BEGIN
  next_val := nextval('public.auto_parts_delivery_note_seq');
  RETURN p_prefix || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- ─── Delivery notes ───
CREATE TABLE IF NOT EXISTS public.auto_parts_delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_note_number TEXT NOT NULL,
  sale_id UUID REFERENCES public.auto_parts_sales(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.auto_parts_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  client_address TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'delivered', 'cancelled')),
  delivered_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_parts_delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES public.auto_parts_delivery_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.auto_parts_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'pce',
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_business ON public.auto_parts_delivery_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_number ON public.auto_parts_delivery_notes(delivery_note_number);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_sale ON public.auto_parts_delivery_notes(sale_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_note ON public.auto_parts_delivery_note_items(delivery_note_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.auto_parts_delivery_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_auto_parts_delivery_notes_updated_at ON public.auto_parts_delivery_notes;
CREATE TRIGGER trg_auto_parts_delivery_notes_updated_at
  BEFORE UPDATE ON public.auto_parts_delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_delivery_notes_updated_at();

-- RLS
ALTER TABLE public.auto_parts_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_parts_delivery_note_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delivery_notes_business_access') THEN
    CREATE POLICY delivery_notes_business_access ON public.auto_parts_delivery_notes
      FOR ALL USING (
        business_id IN (SELECT b.id FROM public.businesses b JOIN public.profiles p ON p.business_id = b.id WHERE p.id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'delivery_note_items_business_access') THEN
    CREATE POLICY delivery_note_items_business_access ON public.auto_parts_delivery_note_items
      FOR ALL USING (
        business_id IN (SELECT b.id FROM public.businesses b JOIN public.profiles p ON p.business_id = b.id WHERE p.id = auth.uid())
      );
  END IF;
END $$;

-- ─── CRUD RPCs ───

CREATE OR REPLACE FUNCTION public.create_auto_parts_delivery_note(
  p_business_id UUID,
  p_sale_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_notes TEXT DEFAULT NULL,
  p_prefix TEXT DEFAULT 'BL-',
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_number TEXT;
  v_item JSONB;
  v_delivered_at TIMESTAMPTZ;
BEGIN
  v_number := generate_auto_parts_delivery_note_number(p_prefix);
  IF p_status = 'delivered' THEN v_delivered_at := now(); END IF;

  INSERT INTO public.auto_parts_delivery_notes
    (business_id, delivery_note_number, sale_id, client_id, client_name, client_phone, client_address,
     status, delivered_at, notes, created_by)
  VALUES
    (p_business_id, v_number, p_sale_id, p_client_id, p_client_name, p_client_phone, p_client_address,
     p_status, v_delivered_at, p_notes, auth.uid())
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_delivery_note_items
      (delivery_note_id, product_id, product_name, quantity, unit, business_id)
    VALUES (
      v_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      COALESCE(v_item->>'unit', 'pce'),
      p_business_id
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'delivery_note_number', v_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT to_jsonb(dn) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
      FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.id = p_id AND (dn.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_auto_parts_delivery_notes(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(dn) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
        FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
    )
    ORDER BY dn.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.business_id = p_business_id OR dn.business_id IS NULL
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_auto_parts_delivery_note(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID; v_old_status TEXT; v_delivered_at TIMESTAMPTZ;
BEGIN
  SELECT business_id, status INTO v_biz, v_old_status FROM public.auto_parts_delivery_notes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  IF p_status = 'delivered' AND v_old_status != 'delivered' THEN v_delivered_at := now(); END IF;

  UPDATE public.auto_parts_delivery_notes SET
    status = COALESCE(p_status, status),
    notes = COALESCE(p_notes, notes),
    delivered_at = COALESCE(v_delivered_at, delivered_at)
  WHERE id = p_id;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.auto_parts_delivery_note_items WHERE delivery_note_id = p_id;
    INSERT INTO public.auto_parts_delivery_note_items
      (delivery_note_id, product_id, product_name, quantity, unit, business_id)
    SELECT p_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
           (v_item->>'quantity')::NUMERIC, COALESCE(v_item->>'unit', 'pce'), v_biz
    FROM jsonb_array_elements(p_items) v_item;
  END IF;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_delivery_notes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_delivery_note_items WHERE delivery_note_id = p_id;
  DELETE FROM public.auto_parts_delivery_notes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_auto_parts_delivery_note_number TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_delivery_note TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_delivery_note TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_delivery_notes TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_delivery_note TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_delivery_note TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260805 applied: delivery notes module'; END $$;
