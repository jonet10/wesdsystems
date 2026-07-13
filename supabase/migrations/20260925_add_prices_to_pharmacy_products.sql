-- Add cost_price and sale_price columns to public.pharmacy_products
ALTER TABLE public.pharmacy_products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.pharmacy_products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2) DEFAULT 0;
