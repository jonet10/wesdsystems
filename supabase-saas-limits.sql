-- =================================================================================
-- MIGRATION : Système d'abonnements SaaS, Limites d'employés et Logo d'entreprise
-- =================================================================================

-- 1. CREATION DE LA TABLE `subscription_plans`
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,          -- Nom du plan (ex: STARTER, PRO, PREMIUM)
    monthly_price NUMERIC(10, 2) NOT NULL,     -- Prix mensuel
    currency VARCHAR(3) DEFAULT 'HTG',         -- Devise par défaut
    max_employees INTEGER NOT NULL DEFAULT 10, -- Limite d'employés
    max_salons INTEGER NOT NULL DEFAULT 1,     -- Limite de salons
    features JSONB DEFAULT '[]'::jsonb,        -- Liste des fonctionnalités actives
    is_active BOOLEAN DEFAULT true,            -- Plan activé/désactivé
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AJOUT DES COLONNES SUR `businesses` (Salon)
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 3. INSERTION DU PLAN `STARTER` (1500 HTG / mois, max 10 employés)
INSERT INTO public.subscription_plans (name, monthly_price, currency, max_employees, max_salons, features) VALUES
('STARTER', 1500.00, 'HTG', 10, 1, '["reservations_illimitees", "gestion_clients", "analytics_simple"]')
ON CONFLICT (name) DO UPDATE 
SET monthly_price = EXCLUDED.monthly_price, max_employees = EXCLUDED.max_employees, features = EXCLUDED.features;

-- Lier par défaut les salons existants au plan STARTER s'ils n'ont pas de plan
DO $$
DECLARE
    starter_plan_id UUID;
BEGIN
    SELECT id INTO starter_plan_id FROM public.subscription_plans WHERE name = 'STARTER' LIMIT 1;
    UPDATE public.businesses SET plan_id = starter_plan_id WHERE plan_id IS NULL;
END $$;

-- 4. CREATION DU TRIGGER DE VALIDATION BACKEND (Limites employés)
CREATE OR REPLACE FUNCTION public.check_employee_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
    plan_name VARCHAR;
BEGIN
    -- Obtenir le nombre actuel d'employés pour ce salon
    SELECT COUNT(*) INTO current_count 
    FROM public.employees 
    WHERE business_id = NEW.business_id;

    -- Obtenir la limite du plan lié à ce salon
    SELECT sp.max_employees, sp.name INTO max_allowed, plan_name
    FROM public.businesses b
    JOIN public.subscription_plans sp ON b.plan_id = sp.id
    WHERE b.id = NEW.business_id;

    -- Si aucun plan spécifique n'est trouvé, on applique la limite par défaut du STARTER (10)
    IF max_allowed IS NULL THEN
        max_allowed := 10;
        plan_name := 'STARTER';
    END IF;

    -- Vérification de la limite
    IF current_count >= max_allowed THEN
        RAISE EXCEPTION 'Vous avez atteint la limite maximale de % employés pour votre abonnement actuel (Plan %).', max_allowed, plan_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attacher le trigger à la table employees
DROP TRIGGER IF EXISTS enforce_employee_limit ON public.employees;
CREATE TRIGGER enforce_employee_limit
BEFORE INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.check_employee_limit();

-- 5. CREATION DU BUCKET STORAGE POUR LES LOGOS
-- Note: L'API DDL de Supabase Storage nécessite d'insérer dans storage.buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politiques de sécurité Storage (RLS)
-- Tout le monde peut voir les logos
CREATE POLICY "Logos are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

-- Seuls les utilisateurs authentifiés peuvent uploader un logo
CREATE POLICY "Authenticated users can upload logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Authenticated users can update logos" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can delete logos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'logos');

-- 6. RLS SUR LA TABLE `subscription_plans`
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscription plans are readable by everyone" ON public.subscription_plans FOR SELECT USING (true);

-- Seul le Super Admin peut modifier les plans
CREATE POLICY "Super Admins can manage plans" ON public.subscription_plans 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
);

-- =================================================================================
-- FIN DE LA MIGRATION
-- =================================================================================
