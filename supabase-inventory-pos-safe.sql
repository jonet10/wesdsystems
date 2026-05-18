-- =================================================================================
-- WESD SYSTEMS - INVENTORY + POS + ANALYTICS (SAFE PRODUCTION MIGRATION)
-- Date: 2026-05-18
--
-- Incremental and backward-compatible migration for:
-- - product categories
-- - products inventory
-- - stock movements
-- - sales + sale items
-- - stock alerts
-- - automatic stock decrement on product sale
-- - multi-tenant RLS
--
-- Rollback (manual):
-- DROP TRIGGER IF EXISTS trg_sale_item_stock ON public.sale_items;
-- DROP FUNCTION IF EXISTS public.apply_sale_item_stock();
-- DROP FUNCTION IF EXISTS public.create_stock_alert_if_needed(uuid, uuid);
-- DROP TABLE IF EXISTS public.stock_alerts;
-- DROP TABLE IF EXISTS public.sale_items;
-- DROP TABLE IF EXISTS public.sales;
-- DROP TABLE IF EXISTS public.inventory_movements;
-- DROP TABLE IF EXISTS public.products;
-- DROP TABLE IF EXISTS public.product_categories;
-- =================================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  minimum_stock numeric(12,3) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'sale', 'refund')),
  quantity numeric(12,3) NOT NULL,
  unit_cost numeric(12,2),
  note text,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_business ON public.inventory_movements(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_number text,
  customer_name text,
  customer_id uuid,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'moncash', 'natcash', 'card', 'mixed')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency_code varchar(3),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'refunded')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_business_created ON public.sales(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'service')),
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
    OR
    (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_business ON public.sale_items(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiring_soon')),
  message text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_business ON public.stock_alerts(business_id, is_resolved, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_stock_alert_if_needed(p_business_id uuid, p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_qty numeric(12,3);
  v_min numeric(12,3);
  v_name text;
BEGIN
  SELECT quantity, minimum_stock, name
  INTO v_qty, v_min, v_name
  FROM public.products
  WHERE id = p_product_id
    AND business_id = p_business_id;

  IF v_qty IS NULL THEN
    RETURN;
  END IF;

  IF v_qty <= 0 THEN
    INSERT INTO public.stock_alerts (business_id, product_id, alert_type, message)
    VALUES (p_business_id, p_product_id, 'out_of_stock', format('Rupture: %s', v_name));
  ELSIF v_qty <= v_min THEN
    INSERT INTO public.stock_alerts (business_id, product_id, alert_type, message)
    VALUES (p_business_id, p_product_id, 'low_stock', format('Attention: %s stock faible (%s restants)', v_name, v_qty));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sale_item_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_qty numeric(12,3);
BEGIN
  IF NEW.item_type <> 'product' OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT quantity
  INTO v_current_qty
  FROM public.products
  WHERE id = NEW.product_id
    AND business_id = NEW.business_id
  FOR UPDATE;

  IF v_current_qty IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_current_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour ce produit';
  END IF;

  UPDATE public.products
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id
    AND business_id = NEW.business_id;

  INSERT INTO public.inventory_movements (
    business_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    note,
    reference_type,
    reference_id,
    created_by
  )
  SELECT
    NEW.business_id,
    NEW.product_id,
    'sale',
    NEW.quantity,
    p.purchase_price,
    format('Vente POS %s', NEW.sale_id),
    'sale',
    NEW.sale_id,
    auth.uid()
  FROM public.products p
  WHERE p.id = NEW.product_id;

  PERFORM public.create_stock_alert_if_needed(NEW.business_id, NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_item_stock ON public.sale_items;
CREATE TRIGGER trg_sale_item_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.apply_sale_item_stock();

-- Seed default categories for all businesses (idempotent)
INSERT INTO public.product_categories (business_id, name, description)
SELECT b.id, c.name, c.description
FROM public.businesses b
CROSS JOIN (
  VALUES
    ('boissons', 'Boissons non alcoolisées'),
    ('alcool', 'Bières, rhum, spiritueux'),
    ('beauté', 'Produits beauté et capillaires'),
    ('accessoires', 'Accessoires et outils'),
    ('alimentation', 'Snacks et alimentation'),
    ('services', 'Services vendus en caisse')
) AS c(name, description)
ON CONFLICT (business_id, name) DO NOTHING;

-- ======================
-- RLS Multi-tenant
-- ======================
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- Generic policy helper pattern by business_id
DROP POLICY IF EXISTS product_categories_tenant_select ON public.product_categories;
CREATE POLICY product_categories_tenant_select ON public.product_categories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = product_categories.business_id
      )
  )
);

DROP POLICY IF EXISTS product_categories_tenant_manage ON public.product_categories;
CREATE POLICY product_categories_tenant_manage ON public.product_categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = product_categories.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner') OR p.role_normalized = 'studio_admin')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = product_categories.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner') OR p.role_normalized = 'studio_admin')
        )
      )
  )
);

DROP POLICY IF EXISTS products_tenant_select ON public.products;
CREATE POLICY products_tenant_select ON public.products
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = products.business_id
      )
  )
);

DROP POLICY IF EXISTS products_tenant_manage ON public.products;
CREATE POLICY products_tenant_manage ON public.products
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = products.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner') OR p.role_normalized = 'studio_admin')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = products.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner') OR p.role_normalized = 'studio_admin')
        )
      )
  )
);

DROP POLICY IF EXISTS inventory_movements_tenant_select ON public.inventory_movements;
CREATE POLICY inventory_movements_tenant_select ON public.inventory_movements
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = inventory_movements.business_id
      )
  )
);

DROP POLICY IF EXISTS inventory_movements_tenant_manage ON public.inventory_movements;
CREATE POLICY inventory_movements_tenant_manage ON public.inventory_movements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = inventory_movements.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = inventory_movements.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
);

DROP POLICY IF EXISTS sales_tenant_select ON public.sales;
CREATE POLICY sales_tenant_select ON public.sales
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = sales.business_id
      )
  )
);

DROP POLICY IF EXISTS sales_tenant_manage ON public.sales;
CREATE POLICY sales_tenant_manage ON public.sales
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = sales.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = sales.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
);

DROP POLICY IF EXISTS sale_items_tenant_select ON public.sale_items;
CREATE POLICY sale_items_tenant_select ON public.sale_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = sale_items.business_id
      )
  )
);

DROP POLICY IF EXISTS sale_items_tenant_manage ON public.sale_items;
CREATE POLICY sale_items_tenant_manage ON public.sale_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = sale_items.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = sale_items.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
);

DROP POLICY IF EXISTS stock_alerts_tenant_select ON public.stock_alerts;
CREATE POLICY stock_alerts_tenant_select ON public.stock_alerts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR p.business_id = stock_alerts.business_id
      )
  )
);

DROP POLICY IF EXISTS stock_alerts_tenant_manage ON public.stock_alerts;
CREATE POLICY stock_alerts_tenant_manage ON public.stock_alerts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = stock_alerts.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'super_admin'
        OR p.role_normalized = 'super_admin'
        OR (
          p.business_id = stock_alerts.business_id
          AND (p.role IN ('studio_admin', 'salon_admin', 'owner', 'employee') OR p.role_normalized IN ('studio_admin', 'employee'))
        )
      )
  )
);

COMMIT;
