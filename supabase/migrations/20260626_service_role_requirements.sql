-- ════════════════════════════════════════════════════════════════════════════
-- SERVICE ↔ EMPLOYEE ROLE REQUIREMENTS
-- Maps each service to the employee roles qualified to perform it.
-- Adds new professional roles (esthetician, makeup_artist) and
-- allowed_roles to service categories.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. ADD NEW PROFESSIONAL ROLES ───

DO $$ BEGIN
  ALTER TYPE salon_employee_role ADD VALUE IF NOT EXISTS 'esthetician';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE salon_employee_role ADD VALUE IF NOT EXISTS 'makeup_artist';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. ADD ALLOWED_ROLES TO SERVICE CATEGORIES ───

ALTER TABLE salon_service_categories
  ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT '{}';

-- ─── 3. SERVICE-ROLE REQUIREMENTS TABLE ───

CREATE TABLE IF NOT EXISTS public.service_role_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  role salon_employee_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id, role)
);

CREATE INDEX IF NOT EXISTS idx_service_role_req_service ON public.service_role_requirements(service_id);
CREATE INDEX IF NOT EXISTS idx_service_role_req_role ON public.service_role_requirements(role);

-- ─── 4. UPDATE REQUIRES_EMPLOYEE ON EXISTING SERVICES ───
-- Categories where employee assignment is mandatory at checkout

WITH category_rules AS (
  SELECT id, name FROM salon_service_categories
  WHERE name IN ('Coupe & Coiffure', 'Barbier', 'Soins Capillaires', 'Coloration')
)
UPDATE salon_services s
SET requires_employee = true
FROM category_rules c
WHERE c.id = s.category_id;

-- Categories where employee assignment is optional

WITH category_rules AS (
  SELECT id, name FROM salon_service_categories
  WHERE name IN ('Manucure', 'Pédicure', 'Onglerie', 'Soins du Visage', 'Maquillage',
                 'Massage & Spa', 'Extensions de Cheveux', 'Extensions de Cils',
                 'Épilation', 'Services Express', 'Autres Prestations')
)
UPDATE salon_services s
SET requires_employee = false
FROM category_rules c
WHERE c.id = s.category_id;

-- ─── 5. SEED SERVICE-ROLE REQUIREMENTS ───
-- Populate from category allowed_roles; safe, uses ON CONFLICT DO NOTHING

INSERT INTO public.service_role_requirements (service_id, role)
SELECT s.id, unnest(c.allowed_roles)::salon_employee_role
FROM public.salon_services s
JOIN public.salon_service_categories c ON c.id = s.category_id
WHERE s.is_active = true
  AND c.allowed_roles IS NOT NULL
  AND array_length(c.allowed_roles, 1) > 0
ON CONFLICT (service_id, role) DO NOTHING;
