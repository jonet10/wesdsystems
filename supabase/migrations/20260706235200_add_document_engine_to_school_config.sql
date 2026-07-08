ALTER TABLE school_configurations
ADD COLUMN IF NOT EXISTS use_document_engine BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS document_engine_settings JSONB DEFAULT '{}'::jsonb;
