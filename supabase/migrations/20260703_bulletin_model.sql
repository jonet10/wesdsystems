-- Migration: Add bulletin_model to school_configurations
-- Run this in your Supabase SQL Editor

ALTER TABLE public.school_configurations
  ADD COLUMN IF NOT EXISTS bulletin_model TEXT DEFAULT 'A'
    CHECK (bulletin_model IN ('A', 'B', 'C'));

-- Update existing rows to default 'A'
UPDATE public.school_configurations
  SET bulletin_model = 'A'
  WHERE bulletin_model IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
