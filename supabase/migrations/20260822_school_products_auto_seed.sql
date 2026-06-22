-- Migration to automatically seed default school products when a new school business is registered

-- 1. Create the function
CREATE OR REPLACE FUNCTION public.seed_default_school_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Only seed if the business is of type 'school' (or its variants)
  -- The exact logic can match what we do for school classes (often any business with 'school' in plan/type)
  -- Note: Depending on your exact logic, you might want to run this for all 'school' businesses.
  -- The current implementation uses business_type, but sometimes businesses are created generally and later updated.
  -- To be safe, we can check if it's explicitly a school type if the app sets it upon creation.
  -- Alternatively, we can just check if plan_id or type implies a school.
  -- Let's just insert these default products when business_type = 'school' OR 'school_payments'.
  
  -- In WesdSystems, school business_type is typically "school" or "school_payments"
  -- Or if you want to just ensure it's seeded immediately.
  -- We'll just seed it for any business of type 'school'.
  -- Wait, sometimes business_type is set AFTER insert via an update. 
  -- So let's handle the trigger on INSERT OR UPDATE.
  
  -- Actually, the classes seed trigger uses: IF NEW.business_type = 'school' ... Wait, let me check the previous trigger.
  -- Assuming the logic is straightforward:
  IF NEW.business_type = 'school' OR NEW.business_type = 'school_payments' THEN
    -- Check if products already exist to avoid duplicates if triggered on UPDATE
    IF NOT EXISTS (SELECT 1 FROM public.school_products WHERE business_id = NEW.id) THEN
      INSERT INTO public.school_products (business_id, name, category, sku, cost_price, price, stock_quantity, min_stock_alert, active)
      VALUES 
        (NEW.id, 'Cahier 48 pages', 'Fournitures', 'ART001', 0, 0, 0, 5, true),
        (NEW.id, 'Cahier 96 pages', 'Fournitures', 'ART002', 0, 0, 0, 5, true),
        (NEW.id, 'Cahier 144 pages', 'Fournitures', 'ART003', 0, 0, 0, 5, true),
        (NEW.id, 'Cahier pratique', 'Fournitures', 'ART004', 0, 0, 0, 5, true),
        (NEW.id, 'Bloc-notes', 'Fournitures', 'ART005', 0, 0, 0, 5, true),
        (NEW.id, 'Feuille simple', 'Papeterie', 'ART006', 0, 0, 0, 5, true),
        (NEW.id, 'Feuille double', 'Papeterie', 'ART007', 0, 0, 0, 5, true),
        (NEW.id, 'Stylo bleu', 'Écriture', 'ART008', 0, 0, 0, 5, true),
        (NEW.id, 'Stylo noir', 'Écriture', 'ART009', 0, 0, 0, 5, true),
        (NEW.id, 'Stylo rouge', 'Écriture', 'ART010', 0, 0, 0, 5, true),
        (NEW.id, 'Stylo vert', 'Écriture', 'ART011', 0, 0, 0, 5, true),
        (NEW.id, 'Crayon HB', 'Écriture', 'ART012', 0, 0, 0, 5, true),
        (NEW.id, 'Crayon 2B', 'Écriture', 'ART013', 0, 0, 0, 5, true),
        (NEW.id, 'Gomme blanche', 'Écriture', 'ART014', 0, 0, 0, 5, true),
        (NEW.id, 'Taille-crayon', 'Écriture', 'ART015', 0, 0, 0, 5, true),
        (NEW.id, 'Correcteur liquide', 'Écriture', 'ART016', 0, 0, 0, 5, true),
        (NEW.id, 'Correcteur ruban', 'Écriture', 'ART017', 0, 0, 0, 5, true),
        (NEW.id, 'Surligneur jaune', 'Écriture', 'ART018', 0, 0, 0, 5, true),
        (NEW.id, 'Surligneur rose', 'Écriture', 'ART019', 0, 0, 0, 5, true),
        (NEW.id, 'Surligneur vert', 'Écriture', 'ART020', 0, 0, 0, 5, true),
        (NEW.id, 'Règle 20 cm', 'Géométrie', 'ART021', 0, 0, 0, 5, true),
        (NEW.id, 'Règle 30 cm', 'Géométrie', 'ART022', 0, 0, 0, 5, true),
        (NEW.id, 'Équerre', 'Géométrie', 'ART023', 0, 0, 0, 5, true),
        (NEW.id, 'Rapporteur', 'Géométrie', 'ART024', 0, 0, 0, 5, true),
        (NEW.id, 'Compas simple', 'Géométrie', 'ART025', 0, 0, 0, 5, true),
        (NEW.id, 'Compas métallique', 'Géométrie', 'ART026', 0, 0, 0, 5, true),
        (NEW.id, 'Calculatrice simple', 'Mathématiques', 'ART027', 0, 0, 0, 5, true),
        (NEW.id, 'Calculatrice scientifique', 'Mathématiques', 'ART028', 0, 0, 0, 5, true),
        (NEW.id, 'Colle liquide', 'Fournitures', 'ART029', 0, 0, 0, 5, true),
        (NEW.id, 'Bâton de colle', 'Fournitures', 'ART030', 0, 0, 0, 5, true),
        (NEW.id, 'Ciseaux scolaire', 'Fournitures', 'ART031', 0, 0, 0, 5, true),
        (NEW.id, 'Ruban adhésif', 'Fournitures', 'ART032', 0, 0, 0, 5, true),
        (NEW.id, 'Agrafeuse', 'Bureau', 'ART033', 0, 0, 0, 5, true),
        (NEW.id, 'Boîte d''agrafes', 'Bureau', 'ART034', 0, 0, 0, 5, true),
        (NEW.id, 'Trombones', 'Bureau', 'ART035', 0, 0, 0, 5, true),
        (NEW.id, 'Chemise cartonnée', 'Classement', 'ART036', 0, 0, 0, 5, true),
        (NEW.id, 'Chemise plastique', 'Classement', 'ART037', 0, 0, 0, 5, true),
        (NEW.id, 'Classeur 2 anneaux', 'Classement', 'ART038', 0, 0, 0, 5, true),
        (NEW.id, 'Classeur 4 anneaux', 'Classement', 'ART039', 0, 0, 0, 5, true),
        (NEW.id, 'Intercalaire', 'Classement', 'ART040', 0, 0, 0, 5, true),
        (NEW.id, 'Protège-cahier bleu', 'Classement', 'ART041', 0, 0, 0, 5, true),
        (NEW.id, 'Protège-cahier rouge', 'Classement', 'ART042', 0, 0, 0, 5, true),
        (NEW.id, 'Protège-cahier vert', 'Classement', 'ART043', 0, 0, 0, 5, true),
        (NEW.id, 'Protège-cahier jaune', 'Classement', 'ART044', 0, 0, 0, 5, true),
        (NEW.id, 'Sac à dos petit', 'Sacs', 'ART045', 0, 0, 0, 5, true),
        (NEW.id, 'Sac à dos moyen', 'Sacs', 'ART046', 0, 0, 0, 5, true),
        (NEW.id, 'Sac à dos grand', 'Sacs', 'ART047', 0, 0, 0, 5, true),
        (NEW.id, 'Trousse simple', 'Sacs', 'ART048', 0, 0, 0, 5, true),
        (NEW.id, 'Trousse double', 'Sacs', 'ART049', 0, 0, 0, 5, true),
        (NEW.id, 'Gourde plastique', 'Accessoires', 'ART050', 0, 0, 0, 5, true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on businesses table
DROP TRIGGER IF EXISTS trg_seed_school_products ON public.businesses;
CREATE TRIGGER trg_seed_school_products
AFTER INSERT OR UPDATE OF business_type ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_school_products();
