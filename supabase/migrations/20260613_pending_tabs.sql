-- ============================================================================
-- WESD SYSTEMS - Pending Tabs / Fiches en attente
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pending_tab_status') THEN
    CREATE TYPE public.pending_tab_status AS ENUM ('open', 'closed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pending_tab_item_type') THEN
    CREATE TYPE public.pending_tab_item_type AS ENUM ('product', 'service');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.pending_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_number VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  client_id UUID REFERENCES public.salon_customers(id) ON DELETE SET NULL,
  guest_name VARCHAR(255),
  status public.pending_tab_status NOT NULL DEFAULT 'open',
  branch_id UUID NOT NULL REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES public.salon_employees(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.pending_tab_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.pending_tabs(id) ON DELETE CASCADE,
  item_type public.pending_tab_item_type NOT NULL,
  item_id UUID NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.salon_employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_tabs_branch_status_opened
  ON public.pending_tabs(branch_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_tabs_branch_day_number
  ON public.pending_tabs(branch_id, (opened_at::date), tab_number);

CREATE INDEX IF NOT EXISTS idx_pending_tab_items_tab_id
  ON public.pending_tab_items(tab_id);

CREATE INDEX IF NOT EXISTS idx_pending_tab_items_item_lookup
  ON public.pending_tab_items(tab_id, item_type, item_id);

ALTER TABLE public.pending_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_tab_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "pending_tabs_all"
    ON public.pending_tabs FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pending_tab_items_all"
    ON public.pending_tab_items FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.generate_pending_tab_number()
RETURNS TRIGGER AS $$
DECLARE
  v_date_key DATE := COALESCE(NEW.opened_at::date, CURRENT_DATE);
  v_next_number INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.branch_id::text || ':' || v_date_key::text));

  SELECT COUNT(*) + 1
    INTO v_next_number
    FROM public.pending_tabs
   WHERE branch_id = NEW.branch_id
     AND opened_at::date = v_date_key;

  NEW.tab_number := 'TAB-' || LPAD(v_next_number::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_pending_tab_number ON public.pending_tabs;
CREATE TRIGGER trigger_generate_pending_tab_number
  BEFORE INSERT ON public.pending_tabs
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_pending_tab_number();

CREATE OR REPLACE FUNCTION public.sync_pending_tab_item_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal := ROUND(COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 1), 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_pending_tab_item_subtotal ON public.pending_tab_items;
CREATE TRIGGER trigger_sync_pending_tab_item_subtotal
  BEFORE INSERT OR UPDATE OF unit_price, quantity ON public.pending_tab_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pending_tab_item_subtotal();

