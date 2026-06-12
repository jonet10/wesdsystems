-- ════════════════════════════════════════════════════════════════════════════
-- Fix nested aggregate calls in auto_parts_weekly_trend and
-- auto_parts_hourly_activity (SUM/COUNT inside jsonb_agg)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_parts_weekly_trend(
  p_business_id UUID,
  p_weeks INT DEFAULT 12
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start TIMESTAMPTZ := date_trunc('week', now()) - ((p_weeks - 1) || ' weeks')::INTERVAL;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'week_start', to_char(week_start, 'YYYY-MM-DD'),
      'total_sales', total_sales,
      'order_count', order_count
    )
    ORDER BY week_start
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT date_trunc('week', s.created_at) AS week_start,
           COALESCE(SUM(s.total), 0) AS total_sales,
           COUNT(s.id)::INT AS order_count
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.created_at >= v_start
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY date_trunc('week', s.created_at)
  ) agg;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_parts_hourly_activity(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hour', hour,
      'day_of_week', day_of_week,
      'sale_count', sale_count,
      'revenue', revenue
    )
    ORDER BY day_of_week, hour
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT EXTRACT(HOUR FROM s.created_at)::INT AS hour,
           EXTRACT(DOW FROM s.created_at)::INT AS day_of_week,
           COUNT(*)::INT AS sale_count,
           COALESCE(SUM(s.total), 0)::NUMERIC AS revenue
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY EXTRACT(HOUR FROM s.created_at), EXTRACT(DOW FROM s.created_at)
  ) agg;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_weekly_trend TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_hourly_activity TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Fix nested aggregates: weekly_trend, hourly_activity'; END $$;
