-- Expand pharmacy_stock_movements type constraint to support 'expiry'
ALTER TABLE public.pharmacy_stock_movements DROP CONSTRAINT IF EXISTS pharmacy_stock_movements_type_check;

ALTER TABLE public.pharmacy_stock_movements
  ADD CONSTRAINT pharmacy_stock_movements_type_check 
  CHECK (type IN ('in', 'out', 'adjustment', 'sale', 'return', 'expiry'));
