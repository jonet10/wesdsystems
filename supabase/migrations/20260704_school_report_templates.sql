-- Migration: Create school_report_templates for visual builder
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.school_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_report_templates_business_id ON public.school_report_templates(business_id);

-- RLS
ALTER TABLE public.school_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_school_report_templates ON public.school_report_templates FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_report_templates ON public.school_report_templates FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_school_report_templates_updated_at
  BEFORE UPDATE ON public.school_report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_school_config_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
