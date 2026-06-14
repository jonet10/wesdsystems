-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Recrée les fonctions RPC manquantes
--
-- Cause: La migration 20260806 a DROP puis CREATE OR REPLACE les fonctions
-- upsert_auto_parts_business_settings et get_auto_parts_business_settings
-- mais si la recréation a échoué (ex: table auto_parts_business_settings
-- inexistante à ce moment), les fonctions sont perdues.
--
-- Ce script recrée proprement les deux fonctions.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. S'assurer que la table existe ───
CREATE TABLE IF NOT EXISTS public.auto_parts_business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  company_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  slogan TEXT,
  whatsapp TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,

  nif TEXT,
  patente TEXT,
  rc TEXT,

  bank_name TEXT,
  bank_account TEXT,

  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  quote_prefix TEXT NOT NULL DEFAULT 'DEV-',
  delivery_note_prefix TEXT NOT NULL DEFAULT 'BL-',

  receipt_footer TEXT,
  receipt_header TEXT,

  low_stock_threshold INTEGER NOT NULL DEFAULT 5,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_business_settings UNIQUE (business_id)
);

ALTER TABLE public.auto_parts_business_settings ENABLE ROW LEVEL SECURITY;

-- ─── 2. upsert_auto_parts_business_settings ───

DROP FUNCTION IF EXISTS public.upsert_auto_parts_business_settings(
  p_business_id UUID, p_company_name TEXT, p_logo_url TEXT,
  p_slogan TEXT, p_whatsapp TEXT, p_address TEXT, p_phone TEXT,
  p_email TEXT, p_website TEXT, p_nif TEXT, p_patente TEXT, p_rc TEXT,
  p_bank_name TEXT, p_bank_account TEXT, p_invoice_prefix TEXT,
  p_quote_prefix TEXT, p_delivery_note_prefix TEXT, p_receipt_footer TEXT,
  p_receipt_header TEXT, p_low_stock_threshold INTEGER
);

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_business_settings(
  p_business_id UUID,
  p_company_name TEXT DEFAULT '',
  p_logo_url TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_nif TEXT DEFAULT NULL,
  p_patente TEXT DEFAULT NULL,
  p_rc TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account TEXT DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT 'INV-',
  p_quote_prefix TEXT DEFAULT 'DEV-',
  p_delivery_note_prefix TEXT DEFAULT 'BL-',
  p_receipt_footer TEXT DEFAULT NULL,
  p_receipt_header TEXT DEFAULT NULL,
  p_low_stock_threshold INTEGER DEFAULT 5,
  p_session_token TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  INSERT INTO public.auto_parts_business_settings
    (business_id, company_name, logo_url, slogan, whatsapp, address, phone, email, website,
     nif, patente, rc, bank_name, bank_account,
     invoice_prefix, quote_prefix, delivery_note_prefix,
     receipt_footer, receipt_header, low_stock_threshold)
  VALUES
    (p_business_id, p_company_name, p_logo_url, p_slogan, p_whatsapp, p_address, p_phone, p_email, p_website,
     p_nif, p_patente, p_rc, p_bank_name, p_bank_account,
     p_invoice_prefix, p_quote_prefix, p_delivery_note_prefix,
     p_receipt_footer, p_receipt_header, p_low_stock_threshold)
  ON CONFLICT (business_id) DO UPDATE SET
    company_name          = EXCLUDED.company_name,
    logo_url              = EXCLUDED.logo_url,
    slogan                = EXCLUDED.slogan,
    whatsapp              = EXCLUDED.whatsapp,
    address               = EXCLUDED.address,
    phone                 = EXCLUDED.phone,
    email                 = EXCLUDED.email,
    website               = EXCLUDED.website,
    nif                   = EXCLUDED.nif,
    patente               = EXCLUDED.patente,
    rc                    = EXCLUDED.rc,
    bank_name             = EXCLUDED.bank_name,
    bank_account          = EXCLUDED.bank_account,
    invoice_prefix        = EXCLUDED.invoice_prefix,
    quote_prefix          = EXCLUDED.quote_prefix,
    delivery_note_prefix  = EXCLUDED.delivery_note_prefix,
    receipt_footer        = EXCLUDED.receipt_footer,
    receipt_header        = EXCLUDED.receipt_header,
    low_stock_threshold   = EXCLUDED.low_stock_threshold
  RETURNING id INTO v_result;

  RETURN jsonb_build_object('id', v_result, 'status', 'saved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_business_settings(
  p_business_id UUID, p_company_name TEXT, p_logo_url TEXT,
  p_slogan TEXT, p_whatsapp TEXT, p_address TEXT, p_phone TEXT,
  p_email TEXT, p_website TEXT, p_nif TEXT, p_patente TEXT, p_rc TEXT,
  p_bank_name TEXT, p_bank_account TEXT, p_invoice_prefix TEXT,
  p_quote_prefix TEXT, p_delivery_note_prefix TEXT, p_receipt_footer TEXT,
  p_receipt_header TEXT, p_low_stock_threshold INTEGER, p_session_token TEXT
) TO anon, authenticated;

-- ─── 3. get_auto_parts_business_settings ───

DROP FUNCTION IF EXISTS public.get_auto_parts_business_settings(p_business_id UUID);

CREATE OR REPLACE FUNCTION public.get_auto_parts_business_settings(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  SELECT jsonb_build_object(
    'id', bs.id,
    'business_id', bs.business_id,
    'company_name', bs.company_name,
    'logo_url', bs.logo_url,
    'slogan', bs.slogan,
    'whatsapp', bs.whatsapp,
    'address', bs.address,
    'phone', bs.phone,
    'email', bs.email,
    'website', bs.website,
    'nif', bs.nif,
    'patente', bs.patente,
    'rc', bs.rc,
    'bank_name', bs.bank_name,
    'bank_account', bs.bank_account,
    'invoice_prefix', bs.invoice_prefix,
    'quote_prefix', bs.quote_prefix,
    'delivery_note_prefix', bs.delivery_note_prefix,
    'receipt_footer', bs.receipt_footer,
    'receipt_header', bs.receipt_header,
    'low_stock_threshold', bs.low_stock_threshold,
    'created_at', bs.created_at,
    'updated_at', bs.updated_at
  ) INTO v_result
  FROM public.auto_parts_business_settings bs
  WHERE bs.business_id = p_business_id;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auto_parts_business_settings(
  p_business_id UUID, p_session_token TEXT
) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. auto_parts_dormant_products — DROP les overloads en conflit
--    Bug: 20260806 a fait CREATE OR REPLACE avec signature (p_business_id, p_days)
--    alors que la fonction 20260801 a (p_business_id, p_session_token, p_days).
--    → 2 overloads existent, PostgREST ne peut pas choisir.
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.auto_parts_dormant_products(p_business_id UUID, p_days INT);
DROP FUNCTION IF EXISTS public.auto_parts_dormant_products(p_business_id UUID, p_session_token TEXT, p_days INT);

CREATE OR REPLACE FUNCTION public.auto_parts_dormant_products(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_days INT DEFAULT 30
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_cutoff TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'sku', p.sku,
      'stock_quantity', p.stock_quantity,
      'cost_price', p.cost_price,
      'stock_value', p.cost_price * p.stock_quantity,
      'unit_price', p.unit_price,
      'category_name', c.name,
      'last_sale_date', last_sale.last_date,
      'days_since_sale', CASE WHEN last_sale.last_date IS NOT NULL
        THEN EXTRACT(DAY FROM now() - last_sale.last_date)::INT ELSE p_days * 2 END
    )
    ORDER BY p.stock_quantity * p.cost_price DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT MAX(s.created_at) AS last_date
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id AND s.business_id = p_business_id
      AND s.refund_status IS DISTINCT FROM 'full'
  ) last_sale ON true
  LEFT JOIN LATERAL (
    SELECT MAX(sm.created_at) AS last_date
    FROM public.auto_parts_stock_movements sm
    WHERE sm.product_id = p.id AND sm.business_id = p_business_id
      AND sm.type IN ('in', 'out', 'sale')
  ) last_movement ON true
  WHERE p.business_id = p_business_id
    AND p.active = true
    AND p.stock_quantity > 0
    AND (
      (last_sale.last_date IS NULL OR last_sale.last_date < v_cutoff)
      AND (last_movement.last_date IS NULL OR last_movement.last_date < v_cutoff)
    );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. auto_parts_store_health — Fix type mismatch v_category_diversity
--    Bug: v_category_diversity déclaré NUMERIC mais stocke un nom de catégorie (TEXT)
--    → "invalid input syntax for type numeric: Additifs"
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.auto_parts_store_health(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_store_health(p_business_id UUID, p_session_token TEXT);

CREATE OR REPLACE FUNCTION public.auto_parts_store_health(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_score NUMERIC := 0;
  v_sales_growth NUMERIC := 0;
  v_stock_turnover NUMERIC := 0;
  v_dormant_ratio NUMERIC := 0;
  v_rupture_ratio NUMERIC := 0;
  v_profitability NUMERIC := 0;
  v_category_count INT := 0;
  v_recommendations TEXT[] := '{}';
  v_result JSONB;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_prev_month_start TIMESTAMPTZ := date_trunc('month', now() - INTERVAL '1 month');
  v_now TIMESTAMPTZ := now();
  v_sales_current NUMERIC;
  v_sales_previous NUMERIC;
  v_total_products INT;
  v_active_products INT;
  v_out_of_stock INT;
  v_dormant_count INT;
  v_total_revenue NUMERIC;
  v_total_cost NUMERIC;
  v_avg_margin NUMERIC;
  v_category_diversity TEXT;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  -- Sales growth (0-25 pts)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_current
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full';

  SELECT COALESCE(SUM(total), 0) INTO v_sales_previous
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_prev_month_start AND created_at < v_month_start
    AND refund_status IS DISTINCT FROM 'full';

  IF v_sales_previous > 0 THEN
    v_sales_growth := ((v_sales_current - v_sales_previous) / v_sales_previous) * 100;
  END IF;

  IF v_sales_growth > 20 THEN v_score := v_score + 25;
  ELSIF v_sales_growth > 10 THEN v_score := v_score + 20;
  ELSIF v_sales_growth > 0 THEN v_score := v_score + 15;
  ELSIF v_sales_growth > -10 THEN v_score := v_score + 10;
  ELSE v_score := v_score + 5;
  END IF;

  IF v_sales_growth < -10 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Baisse des ventes de ' || ROUND(ABS(v_sales_growth), 1) || '% par rapport au mois dernier');
  END IF;

  -- Stock turnover (0-15 pts)
  WITH avg_stock AS (
    SELECT COALESCE(AVG(stock_quantity), 0) AS avg_qty
    FROM public.auto_parts_products
    WHERE business_id = p_business_id AND active = true
  )
  SELECT CASE WHEN a.avg_qty > 0
    THEN COALESCE((SELECT SUM(si.quantity) FROM public.auto_parts_sale_items si
      JOIN public.auto_parts_sales s ON s.id = si.sale_id
      WHERE s.business_id = p_business_id AND s.created_at >= date_trunc('month', now())
        AND s.refund_status IS DISTINCT FROM 'full') / a.avg_qty, 0)
    ELSE 0 END INTO v_stock_turnover
  FROM avg_stock a;

  IF v_stock_turnover > 2 THEN v_score := v_score + 15;
  ELSIF v_stock_turnover > 1 THEN v_score := v_score + 12;
  ELSIF v_stock_turnover > 0.5 THEN v_score := v_score + 8;
  ELSE v_score := v_score + 4;
  END IF;

  IF v_stock_turnover < 0.5 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Rotation du stock faible (' || ROUND(v_stock_turnover, 2) || 'x/mois)');
  END IF;

  -- Dormant ratio (0-20 pts)
  SELECT COUNT(*) INTO v_active_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id AND active = true AND stock_quantity > 0;

  WITH dormant AS (
    SELECT p.id
    FROM public.auto_parts_products p
    WHERE p.business_id = p_business_id AND p.active = true AND p.stock_quantity > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_parts_sale_items si
        JOIN public.auto_parts_sales s ON s.id = si.sale_id
        WHERE si.product_id = p.id AND s.business_id = p_business_id
          AND s.created_at >= now() - INTERVAL '90 days'
      )
  )
  SELECT COUNT(*) INTO v_dormant_count FROM dormant;

  IF v_active_products > 0 THEN
    v_dormant_ratio := (v_dormant_count::NUMERIC / v_active_products) * 100;
  END IF;

  IF v_dormant_ratio < 10 THEN v_score := v_score + 20;
  ELSIF v_dormant_ratio < 25 THEN v_score := v_score + 15;
  ELSIF v_dormant_ratio < 50 THEN v_score := v_score + 10;
  ELSE v_score := v_score + 5;
  END IF;

  IF v_dormant_ratio > 25 THEN
    v_recommendations := array_append(v_recommendations, '⚠ ' || ROUND(v_dormant_ratio, 0) || '% des produits sont dormants');
  END IF;

  -- Rupture ratio (0-15 pts)
  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id AND active = true;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id AND active = true AND stock_quantity <= 0;

  IF v_total_products > 0 THEN
    v_rupture_ratio := (v_out_of_stock::NUMERIC / v_total_products) * 100;
  END IF;

  IF v_rupture_ratio < 2 THEN v_score := v_score + 15;
  ELSIF v_rupture_ratio < 5 THEN v_score := v_score + 12;
  ELSIF v_rupture_ratio < 10 THEN v_score := v_score + 8;
  ELSE v_score := v_score + 4;
  END IF;

  IF v_rupture_ratio > 5 THEN
    v_recommendations := array_append(v_recommendations, '⚠ ' || ROUND(v_rupture_ratio, 0) || '% des produits sont en rupture de stock');
  END IF;

  -- Profitability (0-15 pts)
  WITH profits AS (
    SELECT si.total_price, si.quantity, COALESCE(p.cost_price, 0) AS cost
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= v_month_start
      AND s.refund_status IS DISTINCT FROM 'full'
  )
  SELECT
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(cost * quantity), 0)
  INTO v_total_revenue, v_total_cost
  FROM profits;

  IF v_total_revenue > 0 THEN
    v_avg_margin := ((v_total_revenue - v_total_cost) / v_total_revenue) * 100;
  END IF;

  IF v_avg_margin > 40 THEN v_score := v_score + 15;
  ELSIF v_avg_margin > 30 THEN v_score := v_score + 12;
  ELSIF v_avg_margin > 20 THEN v_score := v_score + 8;
  ELSIF v_avg_margin > 10 THEN v_score := v_score + 5;
  ELSE v_score := v_score + 2;
  END IF;

  IF v_avg_margin < 15 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Marge bénéficiaire faible (' || ROUND(v_avg_margin, 1) || '%)');
  END IF;

  -- Category diversity (0-10 pts)
  SELECT COUNT(*) INTO v_category_count
  FROM (
    SELECT p.category_id
    FROM public.auto_parts_products p
    WHERE p.business_id = p_business_id AND p.active = true
    GROUP BY p.category_id
  ) sub;

  IF v_category_count >= 8 THEN v_score := v_score + 10;
  ELSIF v_category_count >= 5 THEN v_score := v_score + 7;
  ELSIF v_category_count >= 3 THEN v_score := v_score + 4;
  ELSE v_score := v_score + 2;
  END IF;

  IF v_category_count <= 2 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Très faible diversité de catégories (' || v_category_count || ' catégories)');
  END IF;

  -- High category dependency
  WITH cat_revenue AS (
    SELECT COALESCE(c.name, 'Sans catégorie') AS cat_name,
      SUM(si.total_price) AS rev
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
    LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= date_trunc('month', now())
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY c.name
    ORDER BY rev DESC
    LIMIT 1
  )
  SELECT cat_name INTO v_category_diversity
  FROM cat_revenue
  WHERE rev > 0 AND rev >= (SELECT COALESCE(SUM(si2.total_price) * 0.5, 0)
    FROM public.auto_parts_sale_items si2
    JOIN public.auto_parts_sales s2 ON s2.id = si2.sale_id
    WHERE s2.business_id = p_business_id
      AND s2.created_at >= date_trunc('month', now())
      AND s2.refund_status IS DISTINCT FROM 'full');

  IF v_category_diversity IS NOT NULL THEN
    v_recommendations := array_append(v_recommendations, '⚠ Forte dépendance à la catégorie "' || v_category_diversity || '"');
  END IF;

  SELECT jsonb_build_object(
    'score', GREATEST(0, LEAST(100, ROUND(v_score)))::INT,
    'sales_growth', ROUND(v_sales_growth, 1),
    'stock_turnover', ROUND(v_stock_turnover, 2),
    'dormant_ratio', ROUND(v_dormant_ratio, 1),
    'rupture_ratio', ROUND(v_rupture_ratio, 1),
    'margin_pct', ROUND(v_avg_margin, 1),
    'category_count', v_category_count,
    'total_products', v_total_products,
    'active_products', v_active_products,
    'out_of_stock', v_out_of_stock,
    'dormant_count', v_dormant_count,
    'level', CASE
      WHEN v_score >= 90 THEN 'excellent'
      WHEN v_score >= 75 THEN 'bon'
      WHEN v_score >= 50 THEN 'moyen'
      WHEN v_score >= 30 THEN 'surveiller'
      ELSE 'critique'
    END,
    'recommendations', COALESCE(jsonb_agg(r), '[]'::jsonb)
  ) INTO v_result
  FROM (SELECT unnest(v_recommendations) AS r) AS rec;

  IF v_recommendations IS NULL OR array_length(v_recommendations, 1) IS NULL THEN
    v_result := jsonb_set(v_result, '{recommendations}', '[]'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_store_health TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260807 applied: fixed dormant_products overloads + store_health type mismatch'; END $$;
