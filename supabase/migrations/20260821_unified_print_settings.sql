-- Migration pour ajouter les paramètres d'impression unifiés

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS nif TEXT,
ADD COLUMN IF NOT EXISTS rc TEXT,
ADD COLUMN IF NOT EXISTS patente TEXT,
ADD COLUMN IF NOT EXISTS receipt_footer_message TEXT DEFAULT 'Merci pour votre confiance.',
ADD COLUMN IF NOT EXISTS receipt_policy_message TEXT DEFAULT 'Aucun échange ni remboursement après sortie du magasin.',
ADD COLUMN IF NOT EXISTS show_qr_code BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_barcode BOOLEAN DEFAULT false;

-- Si on veut mettre à jour toutes les entreprises existantes avec des valeurs par défaut au cas où
UPDATE public.businesses
SET show_qr_code = true, 
    receipt_footer_message = 'Merci pour votre confiance.', 
    receipt_policy_message = 'Aucun échange ni remboursement après sortie du magasin.'
WHERE show_qr_code IS NULL;
