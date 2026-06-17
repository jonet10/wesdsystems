-- ============================================================================
-- Add official Haitian educational system classes and default seeding
-- ============================================================================

-- 1. Add new columns to school_classes
ALTER TABLE public.school_classes ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.school_classes ADD COLUMN IF NOT EXISTS cycle TEXT;
ALTER TABLE public.school_classes ADD COLUMN IF NOT EXISTS level_order INTEGER;
ALTER TABLE public.school_classes ADD COLUMN IF NOT EXISTS section TEXT;

-- 2. Create the function to seed default classes
CREATE OR REPLACE FUNCTION public.seed_default_school_classes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'school' THEN
    -- Préscolaire
    INSERT INTO public.school_classes (business_id, code, name, cycle, level_order) VALUES
    (NEW.id, 'PS', 'Petite Section', 'Préscolaire', 1),
    (NEW.id, 'MS', 'Moyenne Section', 'Préscolaire', 2),
    (NEW.id, 'GS', 'Grande Section', 'Préscolaire', 3),
    
    -- Fondamental 1er Cycle
    (NEW.id, '1AF', '1ère Année Fondamentale', 'Fondamental 1er Cycle', 4),
    (NEW.id, '2AF', '2ème Année Fondamentale', 'Fondamental 1er Cycle', 5),
    (NEW.id, '3AF', '3ème Année Fondamentale', 'Fondamental 1er Cycle', 6),
    
    -- Fondamental 2e Cycle
    (NEW.id, '4AF', '4ème Année Fondamentale', 'Fondamental 2e Cycle', 7),
    (NEW.id, '5AF', '5ème Année Fondamentale', 'Fondamental 2e Cycle', 8),
    (NEW.id, '6AF', '6ème Année Fondamentale', 'Fondamental 2e Cycle', 9),
    
    -- Fondamental 3e Cycle
    (NEW.id, '7AF', '7ème Année Fondamentale', 'Fondamental 3e Cycle', 10),
    (NEW.id, '8AF', '8ème Année Fondamentale', 'Fondamental 3e Cycle', 11),
    (NEW.id, '9AF', '9ème Année Fondamentale', 'Fondamental 3e Cycle', 12),
    
    -- Secondaire Nouveau
    (NEW.id, 'NS1', 'Nouveau Secondaire 1', 'Secondaire Nouveau', 13),
    (NEW.id, 'NS2', 'Nouveau Secondaire 2', 'Secondaire Nouveau', 14),
    (NEW.id, 'NS3', 'Nouveau Secondaire 3', 'Secondaire Nouveau', 15),
    (NEW.id, 'NS4', 'Nouveau Secondaire 4', 'Secondaire Nouveau', 16);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on businesses table
DROP TRIGGER IF EXISTS trg_seed_school_classes ON public.businesses;
CREATE TRIGGER trg_seed_school_classes
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_school_classes();
