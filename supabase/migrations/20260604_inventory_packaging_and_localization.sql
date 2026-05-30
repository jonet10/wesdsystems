-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS: INVENTORY PACKAGING + GLOBAL I18N SUPPORT
-- Adds retrocompatible packaging fields for products and beverages.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.salon_products
  ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS package_quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purchase_price_global NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unit_profit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS package_profit NUMERIC(10,2);

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS package_quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS purchase_price_global NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unit_profit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS package_profit NUMERIC(10,2);

ALTER TABLE IF EXISTS public.salon_beverages
  ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'case',
  ADD COLUMN IF NOT EXISTS package_quantity INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS purchase_price_global NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unit_profit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS package_profit NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_salon_products_packaging_type ON public.salon_products(packaging_type);
CREATE INDEX IF NOT EXISTS idx_products_packaging_type ON public.products(packaging_type);
CREATE INDEX IF NOT EXISTS idx_salon_beverages_packaging_type ON public.salon_beverages(packaging_type);

COMMENT ON COLUMN public.salon_products.packaging_type IS 'Packaging format used to buy/sell the product.';
COMMENT ON COLUMN public.salon_products.package_quantity IS 'Contained quantity in one package.';
COMMENT ON COLUMN public.salon_products.purchase_price_global IS 'Total purchase price for one package.';
COMMENT ON COLUMN public.salon_beverages.purchase_price_global IS 'Total purchase price for one case/package.';
