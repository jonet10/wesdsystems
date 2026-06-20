-- ============================================================================
-- Add active column to school_classes for enable/disable toggle
-- ============================================================================

ALTER TABLE public.school_classes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Update existing classes to be active by default
UPDATE public.school_classes SET active = true WHERE active IS NULL;
