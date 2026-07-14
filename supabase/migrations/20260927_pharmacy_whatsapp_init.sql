-- ════════════════════════════════════════════════════════════════════════════
-- PHARMACY WHATSAPP NOTIFICATIONS INIT
-- Settings and message logs tables with Row Level Security (RLS)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── SETTINGS TABLE ───
CREATE TABLE IF NOT EXISTS public.pharmacy_whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'openwa' CHECK (provider IN ('openwa', 'ultramsg', 'meta', 'twilio')),
  api_url TEXT,
  api_key TEXT,
  session_name TEXT DEFAULT 'default',
  owner_phone TEXT,
  large_sale_threshold NUMERIC(12,2) DEFAULT 10000.00,
  send_daily_report BOOLEAN DEFAULT true,
  send_weekly_report BOOLEAN DEFAULT true,
  send_monthly_report BOOLEAN DEFAULT true,
  send_low_stock_alerts BOOLEAN DEFAULT true,
  send_expiry_alerts BOOLEAN DEFAULT true,
  send_sales_alerts BOOLEAN DEFAULT true,
  send_register_alerts BOOLEAN DEFAULT true,
  send_void_alerts BOOLEAN DEFAULT true,
  send_return_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── LOGS TABLE ───
CREATE TABLE IF NOT EXISTS public.pharmacy_whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'test', 'daily_report', 'weekly_report', 'monthly_report', 
    'low_stock', 'expiry', 'sales_alert', 'register_open', 
    'register_close', 'void_alert', 'return_alert'
  )),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ENABLE ROW LEVEL SECURITY ───
ALTER TABLE public.pharmacy_whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES (Tenant Guard) ───
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_whatsapp_settings 
  FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) 
  WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_whatsapp_logs 
  FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) 
  WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
