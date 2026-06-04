-- ════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES FOR SUBSCRIPTION PAYMENTS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Business owner can insert payments for their own business
CREATE POLICY "subscription payments owner insert" ON public.subscription_payments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND business_id = public.current_user_business_id()
  );

-- Business owner and super_admin can read payments for their business
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

-- Super admin can manage (approve/reject) all payments
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

-- Business owner can update their own payments (e.g., cancel a pending payment)
CREATE POLICY "subscription payments owner update" ON public.subscription_payments
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND business_id = public.current_user_business_id()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND business_id = public.current_user_business_id()
  );
