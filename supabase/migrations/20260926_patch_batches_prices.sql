UPDATE public.pharmacy_batches b
SET cost_price = p.cost_price,
    sale_price = p.sale_price
FROM public.pharmacy_products p
WHERE b.product_id = p.id
  AND (b.cost_price = 0 OR b.cost_price IS NULL OR b.sale_price = 0 OR b.sale_price IS NULL);
