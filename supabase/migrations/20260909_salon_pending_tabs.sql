-- ============================================================================
-- Migration: Create Pending Tabs Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salon_pending_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.salon_customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES public.salon_employees(id) ON DELETE SET NULL,
  tab_number VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  guest_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salon_pending_tab_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.salon_pending_tabs(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,
  item_id UUID NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  added_by UUID REFERENCES public.salon_employees(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers to auto-fill salon_id from branch_id
CREATE TRIGGER trg_salon_pending_tabs_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_pending_tabs
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();

CREATE TRIGGER trg_salon_pending_tab_items_sync_salon_id
  BEFORE INSERT OR UPDATE ON public.salon_pending_tab_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_branch_salon_id();

-- Triggers for updated_at
CREATE TRIGGER set_salon_pending_tabs_updated_at
  BEFORE UPDATE ON public.salon_pending_tabs
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.salon_pending_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_pending_tab_items ENABLE ROW LEVEL SECURITY;

-- Tenant Guard Policies
CREATE POLICY salon_pending_tabs_tenant_guard ON public.salon_pending_tabs
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

CREATE POLICY salon_pending_tab_items_tenant_guard ON public.salon_pending_tab_items
  FOR ALL
  USING (public.is_super_admin() OR salon_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR salon_id = public.current_user_business_id());

-- Indexes for performance
CREATE INDEX idx_salon_pending_tabs_branch_status ON public.salon_pending_tabs(branch_id, status);
CREATE INDEX idx_salon_pending_tabs_salon_id ON public.salon_pending_tabs(salon_id);
CREATE INDEX idx_salon_pending_tab_items_tab_id ON public.salon_pending_tab_items(tab_id);
CREATE INDEX idx_salon_pending_tab_items_salon_id ON public.salon_pending_tab_items(salon_id);
