-- Add use_document_engine feature flag to school_configurations

ALTER TABLE public.school_configurations
ADD COLUMN IF NOT EXISTS use_document_engine BOOLEAN DEFAULT false;
