CREATE TABLE IF NOT EXISTS public.school_payments_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'contacted', 'onboarding', 'active')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.school_payments_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school payments waitlist super admin all" ON public.school_payments_waitlist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_normalized = 'super_admin')
  );

CREATE POLICY "school payments waitlist owner insert" ON public.school_payments_waitlist
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND business_id = (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "school payments waitlist owner read" ON public.school_payments_waitlist
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND business_id = (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  );
