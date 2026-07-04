-- Migration: Document Engine Core Tables
-- Creates the foundational tables for the Document Engine with strict RLS policies.

CREATE TYPE document_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- 1. Document Templates
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL, -- e.g., 'school', 'auto_parts'
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- e.g., 'report_card', 'invoice'
    status document_status DEFAULT 'DRAFT',
    active_version_id UUID, -- Will reference document_template_versions(id)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Document Template Versions (History)
CREATE TABLE IF NOT EXISTS public.document_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    ast_payload JSONB NOT NULL,
    storage_path VARCHAR(500), -- Path to the original .docx in Supabase Storage
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, version_number)
);

-- Add foreign key constraint to active_version_id now that the versions table exists
ALTER TABLE public.document_templates 
ADD CONSTRAINT fk_active_version 
FOREIGN KEY (active_version_id) 
REFERENCES public.document_template_versions(id) ON DELETE SET NULL;

-- 3. Document Audit Logs
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'TEMPLATE_CREATED', 'VERSION_PUBLISHED'
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Scalability
CREATE INDEX idx_doc_templates_business ON public.document_templates(business_id, module, status);
CREATE INDEX idx_doc_versions_template ON public.document_template_versions(template_id, version_number DESC);
CREATE INDEX idx_doc_audit_logs_business ON public.document_audit_logs(business_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_templates
CREATE POLICY "Users can view templates of their businesses"
    ON public.document_templates FOR SELECT
    USING (business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can manage templates of their businesses"
    ON public.document_templates FOR ALL
    USING (business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
        -- Add specific role checks here if needed (e.g., only admin/manager)
    ));

-- RLS Policies for document_template_versions
CREATE POLICY "Users can view template versions of their businesses"
    ON public.document_template_versions FOR SELECT
    USING (template_id IN (
        SELECT id FROM public.document_templates WHERE business_id IN (
            SELECT business_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Users can manage template versions of their businesses"
    ON public.document_template_versions FOR ALL
    USING (template_id IN (
        SELECT id FROM public.document_templates WHERE business_id IN (
            SELECT business_id FROM public.profiles WHERE id = auth.uid()
        )
    ));

-- RLS Policies for document_audit_logs (Insert / Read Only)
CREATE POLICY "Users can view audit logs of their businesses"
    ON public.document_audit_logs FOR SELECT
    USING (business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "System can insert audit logs"
    ON public.document_audit_logs FOR INSERT
    WITH CHECK (business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_document_engine_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_document_engine_updated_at();
