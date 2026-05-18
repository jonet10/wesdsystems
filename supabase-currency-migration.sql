-- =================================================================================
-- MIGRATION : Système Multi-Devise Intelligent & Tarification Internationale
-- =================================================================================

-- 1. CREATION DE LA TABLE `currencies`
CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(3) PRIMARY KEY,             -- ISO Code (ex: USD, EUR, HTG)
    symbol VARCHAR(5) NOT NULL,              -- Symbole (ex: $, €, G)
    name VARCHAR(50) NOT NULL,               -- Nom complet (ex: US Dollar)
    locale VARCHAR(10) NOT NULL,             -- Locale par défaut pour formatage (ex: en-US, fr-FR)
    exchange_rate NUMERIC(10, 6) DEFAULT 1.0,-- Taux de change (par rapport à une monnaie de base)
    is_default BOOLEAN DEFAULT false,        -- Devise par défaut de la plateforme
    enabled BOOLEAN DEFAULT true             -- Devise activée ou non
);

-- 2. CREATION DE LA TABLE `country_pricing` (Pour abonnements SaaS)
CREATE TABLE IF NOT EXISTS public.country_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(2) NOT NULL,        -- ISO Country Code (ex: HT, US, FR)
    currency_code VARCHAR(3) REFERENCES public.currencies(code) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,          -- Nom du plan (Basic, Pro, Premium)
    monthly_price NUMERIC(10, 2) NOT NULL,
    yearly_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, plan_name)          -- Un seul prix par plan et par pays
);

-- 3. AJOUT DES COLONNES AUX TABLES EXISTANTES
-- (Note: utiliser IF NOT EXISTS ou gérer gracieusement en PL/pgSQL si besoin, mais ALTER TABLE ADD COLUMN IF NOT EXISTS est supporté)
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) REFERENCES public.currencies(code),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'FR';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS currency_preference VARCHAR(3) REFERENCES public.currencies(code),
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'fr';

-- 4. INSERTION DES DEVISES DE BASE
INSERT INTO public.currencies (code, symbol, name, locale, is_default, enabled) VALUES
('EUR', '€', 'Euro', 'fr-FR', true, true),
('USD', '$', 'US Dollar', 'en-US', false, true),
('HTG', 'G', 'Gourde', 'fr-HT', false, true),
('DOP', 'RD$', 'Dominican Peso', 'es-DO', false, true)
ON CONFLICT (code) DO UPDATE 
SET symbol = EXCLUDED.symbol, name = EXCLUDED.name, locale = EXCLUDED.locale;

-- 5. INSERTION DES TARIFS SAAS D'EXEMPLE (Niveau Super Admin)
INSERT INTO public.country_pricing (country_code, currency_code, plan_name, monthly_price, yearly_price) VALUES
('HT', 'HTG', 'Basic', 500.00, 5000.00),
('HT', 'HTG', 'Pro', 1500.00, 15000.00),
('US', 'USD', 'Basic', 9.00, 90.00),
('US', 'USD', 'Pro', 29.00, 290.00),
('FR', 'EUR', 'Basic', 8.00, 80.00),
('FR', 'EUR', 'Pro', 25.00, 250.00),
('DO', 'DOP', 'Basic', 500.00, 5000.00)
ON CONFLICT (country_code, plan_name) DO UPDATE 
SET monthly_price = EXCLUDED.monthly_price, yearly_price = EXCLUDED.yearly_price, currency_code = EXCLUDED.currency_code;

-- 6. GESTION DU RLS (Row Level Security)
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_pricing ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les devises et les prix
CREATE POLICY "Currencies are readable by everyone" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "Pricing is readable by everyone" ON public.country_pricing FOR SELECT USING (true);

-- Seul le Super Admin peut modifier (A ajuster selon votre implémentation des rôles)
CREATE POLICY "Super Admins can manage currencies" ON public.currencies 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
);

CREATE POLICY "Super Admins can manage country pricing" ON public.country_pricing 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
);

-- =================================================================================
-- FIN DE LA MIGRATION
-- =================================================================================
