-- WESD SYSTEMS — Salon vertical refactor support
-- Domain tables for stock movements, purchase entries, audits and split payments.

DO $$ BEGIN
  ALTER TYPE salon_payment_method ADD VALUE IF NOT EXISTS 'mixed';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS public.salon_sales
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.salon_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.salon_products(id) ON DELETE SET NULL,
  beverage_id UUID REFERENCES public.salon_beverages(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'loss', 'audit')),
  quantity_delta INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  unit_cost NUMERIC(12,2),
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (product_id IS NOT NULL OR beverage_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_salon_stock_movements_business
  ON public.salon_stock_movements(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_salon_stock_movements_product
  ON public.salon_stock_movements(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_salon_stock_movements_beverage
  ON public.salon_stock_movements(beverage_id, created_at);
CREATE INDEX IF NOT EXISTS idx_salon_stock_movements_type
  ON public.salon_stock_movements(movement_type);

CREATE TABLE IF NOT EXISTS public.salon_purchase_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  supplier_name TEXT,
  invoice_number TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'HTG',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_purchase_entries_business_date
  ON public.salon_purchase_entries(business_id, purchase_date DESC);

CREATE TABLE IF NOT EXISTS public.salon_inventory_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  expected_total INTEGER DEFAULT 0,
  counted_total INTEGER DEFAULT 0,
  variance_total INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_salon_inventory_audits_business_date
  ON public.salon_inventory_audits(business_id, audit_date DESC);

CREATE TABLE IF NOT EXISTS public.salon_sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.salon_sales(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'moncash', 'natcash', 'card')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency_code VARCHAR(3) DEFAULT 'HTG',
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_sale_payments_sale
  ON public.salon_sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_salon_sale_payments_business
  ON public.salon_sale_payments(business_id, created_at);

ALTER TABLE public.salon_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_purchase_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_sale_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read salon stock movements"
    ON public.salon_stock_movements FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage salon stock movements"
    ON public.salon_stock_movements FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read salon purchase entries"
    ON public.salon_purchase_entries FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage salon purchase entries"
    ON public.salon_purchase_entries FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read salon inventory audits"
    ON public.salon_inventory_audits FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage salon inventory audits"
    ON public.salon_inventory_audits FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read salon sale payments"
    ON public.salon_sale_payments FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage salon sale payments"
    ON public.salon_sale_payments FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

