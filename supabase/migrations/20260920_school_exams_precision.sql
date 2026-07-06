-- Migration 20260920: Increase precision of coefficient in school_exams

ALTER TABLE public.school_exams
  ALTER COLUMN coefficient TYPE NUMERIC(8,2) USING coefficient::NUMERIC(8,2);

ALTER TABLE public.school_exams
  ALTER COLUMN max_points TYPE NUMERIC(8,2) USING max_points::NUMERIC(8,2);
