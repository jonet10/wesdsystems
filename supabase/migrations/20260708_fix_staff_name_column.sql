-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Add missing staff_name column
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_parts_sales' AND column_name = 'staff_name'
  ) THEN
    ALTER TABLE public.auto_parts_sales ADD COLUMN staff_name TEXT;
  END IF;
END $$;
