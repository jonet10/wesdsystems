-- ════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES FOR SUBSCRIPTION PAYMENTS (idempotent, PG14+)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'subscription payments owner insert') THEN
    CREATE POLICY "subscription payments owner insert" ON public.subscription_payments
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND business_id = public.current_user_business_id()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'subscription payments owner read') THEN
    CREATE POLICY "subscription payments owner read" ON public.subscription_payments
      FOR SELECT USING (
        auth.uid() IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.role = 'super_admin' OR p.business_id = subscription_payments.business_id)
          )
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'subscription payments admin manage') THEN
    CREATE POLICY "subscription payments admin manage" ON public.subscription_payments
      FOR ALL USING (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'super_admin'
        )
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'super_admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_payments' AND policyname = 'subscription payments owner update') THEN
    CREATE POLICY "subscription payments owner update" ON public.subscription_payments
      FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND business_id = public.current_user_business_id()
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND business_id = public.current_user_business_id()
      );
  END IF;
END $$;
