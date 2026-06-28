-- Enable Row Level Security (RLS) on service_role_requirements
ALTER TABLE public.service_role_requirements ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS service_role_requirements_tenant_guard ON public.service_role_requirements;

-- Create policy to allow access to service_role_requirements if the user has access to the corresponding service
CREATE POLICY service_role_requirements_tenant_guard ON public.service_role_requirements
  FOR ALL
  USING (
    public.is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM public.salon_services s
      WHERE s.id = service_role_requirements.service_id
        AND s.salon_id = public.current_user_business_id()
    )
  )
  WITH CHECK (
    public.is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM public.salon_services s
      WHERE s.id = service_role_requirements.service_id
        AND s.salon_id = public.current_user_business_id()
    )
  );
