-- ─── 1. FUNCTION: import_standard_pharmacy_catalog ───
CREATE OR REPLACE FUNCTION public.import_standard_pharmacy_catalog(p_business_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_cat_analgesiques UUID;
  v_cat_antibiotiques UUID;
  v_cat_antipaludiques UUID;
  v_cat_antifongiques UUID;
  v_cat_antiparasitaires UUID;
  v_cat_antiallergiques UUID;
  v_cat_gastro UUID;
  v_cat_diabete UUID;
  v_cat_hypertension UUID;
  v_cat_cardiologie UUID;
  v_cat_respiratoire UUID;
  v_cat_vitamines UUID;
  v_cat_femme UUID;
  v_cat_ophtalmologie UUID;
  v_cat_dermatologie UUID;
  v_cat_hospitalier UUID;
  v_cat_pediatrie UUID;
  v_cat_consommables UUID;
BEGIN
  -- Exit if business already has products to prevent duplicates
  IF EXISTS (SELECT 1 FROM public.pharmacy_products WHERE business_id = p_business_id LIMIT 1) THEN
    RETURN 0;
  END IF;

  -- Insert Categories
  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Analgésiques', 'Analgésiques / Antipyrétiques pour soulager la douleur et la fièvre')
  RETURNING id INTO v_cat_analgesiques;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Antibiotiques', 'Antibiotiques pour traiter les infections bactériennes')
  RETURNING id INTO v_cat_antibiotiques;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Antipaludiques', 'Traitements contre le paludisme / malaria')
  RETURNING id INTO v_cat_antipaludiques;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Antifongiques', 'Traitements contre les infections à champignons')
  RETURNING id INTO v_cat_antifongiques;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Antiparasitaires', 'Traitements contre les parasites intestinaux et externes')
  RETURNING id INTO v_cat_antiparasitaires;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Antiallergiques', 'Antihistaminiques pour soulager les allergies')
  RETURNING id INTO v_cat_antiallergiques;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Gastro-entérologie', 'Médicaments pour le système digestif et l''estomac')
  RETURNING id INTO v_cat_gastro;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Diabète', 'Traitements pour le contrôle de la glycémie')
  RETURNING id INTO v_cat_diabete;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Hypertension', 'Médicaments pour la tension artérielle')
  RETURNING id INTO v_cat_hypertension;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Cardiologie', 'Médicaments pour le cœur et le cholestérol')
  RETURNING id INTO v_cat_cardiologie;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Respiratoire', 'Médicaments pour l''asthme, la toux et les poumons')
  RETURNING id INTO v_cat_respiratoire;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Vitamines', 'Vitamines, minéraux et compléments alimentaires')
  RETURNING id INTO v_cat_vitamines;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Santé Femme', 'Compléments et soins pour la santé de la femme et maternité')
  RETURNING id INTO v_cat_femme;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Ophtalmologie', 'Collyres et soins pour les yeux')
  RETURNING id INTO v_cat_ophtalmologie;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Dermatologie', 'Crèmes et antiseptiques pour la peau')
  RETURNING id INTO v_cat_dermatologie;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Hospitalier', 'Solutés de perfusion et produits pour hôpitaux')
  RETURNING id INTO v_cat_hospitalier;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Pédiatrie', 'Produits de soins, laits et réhydratants pour bébés')
  RETURNING id INTO v_cat_pediatrie;

  INSERT INTO public.pharmacy_categories (business_id, name, description)
  VALUES (p_business_id, 'Consommables Médicaux', 'Seringues, compresses, gants et autres consommables')
  RETURNING id INTO v_cat_consommables;

  -- Insert Products
  -- Analgésiques
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_analgesiques, 'Paracétamol 500mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Paracétamol 1000mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Acétaminophène sirop', 'Sirop', 0),
  (p_business_id, v_cat_analgesiques, 'Ibuprofène 200mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Ibuprofène 400mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Ibuprofène 600mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Diclofénac 50mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Diclofénac 75mg', 'Injectable', 0),
  (p_business_id, v_cat_analgesiques, 'Kétoprofène', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Naproxène', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Aspirine 81mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Aspirine 325mg', 'Comprimé', 0),
  (p_business_id, v_cat_analgesiques, 'Tramadol', 'Gélule', 0),
  (p_business_id, v_cat_analgesiques, 'Morphine', 'Injectable', 0),
  (p_business_id, v_cat_analgesiques, 'Codéine', 'Comprimé', 0);

  -- Antibiotiques
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_antibiotiques, 'Amoxicilline 250mg', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Amoxicilline 500mg', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Amoxicilline + Acide Clavulanique', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Azithromycine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Clarithromycine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Érythromycine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Ciprofloxacine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Lévofloxacine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Ofloxacine', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Doxycycline', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Tétracycline', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Cefixime', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Ceftriaxone', 'Injectable', 0),
  (p_business_id, v_cat_antibiotiques, 'Céfalexine', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Céfuroxime', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Gentamicine', 'Injectable', 0),
  (p_business_id, v_cat_antibiotiques, 'Clindamycine', 'Gélule', 0),
  (p_business_id, v_cat_antibiotiques, 'Métronidazole', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Cotrimoxazole', 'Comprimé', 0),
  (p_business_id, v_cat_antibiotiques, 'Nitrofurantoïne', 'Gélule', 0);

  -- Antipaludiques
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_antipaludiques, 'Chloroquine', 'Comprimé', 0),
  (p_business_id, v_cat_antipaludiques, 'Quinine', 'Comprimé', 0),
  (p_business_id, v_cat_antipaludiques, 'Artéméther', 'Injectable', 0),
  (p_business_id, v_cat_antipaludiques, 'Luméfantrine', 'Comprimé', 0),
  (p_business_id, v_cat_antipaludiques, 'Artésunate', 'Injectable', 0),
  (p_business_id, v_cat_antipaludiques, 'Primaquine', 'Comprimé', 0);

  -- Antifongiques
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_antifongiques, 'Fluconazole', 'Gélule', 0),
  (p_business_id, v_cat_antifongiques, 'Kétoconazole', 'Comprimé', 0),
  (p_business_id, v_cat_antifongiques, 'Clotrimazole', 'Crème', 0),
  (p_business_id, v_cat_antifongiques, 'Miconazole', 'Crème', 0),
  (p_business_id, v_cat_antifongiques, 'Nystatine', 'Suspension', 0),
  (p_business_id, v_cat_antifongiques, 'Itraconazole', 'Gélule', 0),
  (p_business_id, v_cat_antifongiques, 'Terbinafine', 'Comprimé', 0),
  (p_business_id, v_cat_antifongiques, 'Griséofulvine', 'Comprimé', 0);

  -- Antiparasitaires
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_antiparasitaires, 'Albendazole', 'Comprimé', 0),
  (p_business_id, v_cat_antiparasitaires, 'Mébendazole', 'Comprimé', 0),
  (p_business_id, v_cat_antiparasitaires, 'Ivermectine', 'Comprimé', 0),
  (p_business_id, v_cat_antiparasitaires, 'Praziquantel', 'Comprimé', 0),
  (p_business_id, v_cat_antiparasitaires, 'Pyrantel', 'Suspension', 0),
  (p_business_id, v_cat_antiparasitaires, 'Niclosamide', 'Comprimé', 0);

  -- Antiallergiques
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_antiallergiques, 'Loratadine', 'Comprimé', 0),
  (p_business_id, v_cat_antiallergiques, 'Cétirizine', 'Comprimé', 0),
  (p_business_id, v_cat_antiallergiques, 'Fexofénadine', 'Comprimé', 0),
  (p_business_id, v_cat_antiallergiques, 'Chlorphéniramine', 'Comprimé', 0),
  (p_business_id, v_cat_antiallergiques, 'Diphénhydramine', 'Sirop', 0);

  -- Gastro-entérologie
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_gastro, 'Oméprazole', 'Gélule', 0),
  (p_business_id, v_cat_gastro, 'Pantoprazole', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Esoméprazole', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Lansoprazole', 'Gélule', 0),
  (p_business_id, v_cat_gastro, 'Ranitidine', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Famotidine', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Hydroxyde d''aluminium', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Gaviscon', 'Suspension', 0),
  (p_business_id, v_cat_gastro, 'Smecta', 'Sachet', 0),
  (p_business_id, v_cat_gastro, 'Lopéramide', 'Gélule', 0),
  (p_business_id, v_cat_gastro, 'Métoclopramide', 'Comprimé', 0),
  (p_business_id, v_cat_gastro, 'Dompéridone', 'Comprimé', 0);

  -- Diabète
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_diabete, 'Metformine 500mg', 'Comprimé', 0),
  (p_business_id, v_cat_diabete, 'Metformine 850mg', 'Comprimé', 0),
  (p_business_id, v_cat_diabete, 'Metformine 1000mg', 'Comprimé', 0),
  (p_business_id, v_cat_diabete, 'Gliclazide', 'Comprimé', 0),
  (p_business_id, v_cat_diabete, 'Glibenclamide', 'Comprimé', 0),
  (p_business_id, v_cat_diabete, 'Insuline Rapide', 'Injectable', 0),
  (p_business_id, v_cat_diabete, 'Insuline NPH', 'Injectable', 0),
  (p_business_id, v_cat_diabete, 'Insuline Glargine', 'Injectable', 0);

  -- Hypertension
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_hypertension, 'Amlodipine', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Losartan', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Valsartan', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Captopril', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Énalapril', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Lisinopril', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Hydrochlorothiazide', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Furosémide', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Spironolactone', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Bisoprolol', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Atenolol', 'Comprimé', 0),
  (p_business_id, v_cat_hypertension, 'Carvédilol', 'Comprimé', 0);

  -- Cardiologie
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_cardiologie, 'Atorvastatine', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Rosuvastatine', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Simvastatine', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Clopidogrel', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Warfarine', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Rivaroxaban', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Apixaban', 'Comprimé', 0),
  (p_business_id, v_cat_cardiologie, 'Digoxine', 'Comprimé', 0);

  -- Respiratoire
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_respiratoire, 'Salbutamol inhalateur', 'Inhalateur', 0),
  (p_business_id, v_cat_respiratoire, 'Salbutamol sirop', 'Sirop', 0),
  (p_business_id, v_cat_respiratoire, 'Budésonide', 'Inhalateur', 0),
  (p_business_id, v_cat_respiratoire, 'Béclométhasone', 'Inhalateur', 0),
  (p_business_id, v_cat_respiratoire, 'Formotérol', 'Inhalateur', 0),
  (p_business_id, v_cat_respiratoire, 'Montélukast', 'Comprimé', 0),
  (p_business_id, v_cat_respiratoire, 'Ambroxol', 'Sirop', 0),
  (p_business_id, v_cat_respiratoire, 'Bromhexine', 'Sirop', 0),
  (p_business_id, v_cat_respiratoire, 'Acétylcystéine', 'Sachet', 0);

  -- Vitamines
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_vitamines, 'Vitamine A', 'Capsule', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine B Complexe', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine B12', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine C 500mg', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine C 1000mg', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine D3', 'Gouttes', 0),
  (p_business_id, v_cat_vitamines, 'Vitamine E', 'Capsule', 0),
  (p_business_id, v_cat_vitamines, 'Zinc', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Fer', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Calcium', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Magnésium', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Acide Folique', 'Comprimé', 0),
  (p_business_id, v_cat_vitamines, 'Oméga 3', 'Capsule', 0);

  -- Santé Femme
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_femme, 'Fer + Acide Folique', 'Comprimé', 0),
  (p_business_id, v_cat_femme, 'Contraceptif Oral', 'Comprimé', 0),
  (p_business_id, v_cat_femme, 'Dépo-Provera', 'Injectable', 0),
  (p_business_id, v_cat_femme, 'Misoprostol', 'Comprimé', 0),
  (p_business_id, v_cat_femme, 'Oxytocine', 'Injectable', 0);

  -- Ophtalmologie
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_ophtalmologie, 'Collyre Lubrifiant', 'Gouttes', 0),
  (p_business_id, v_cat_ophtalmologie, 'Tobramycine Collyre', 'Gouttes', 0),
  (p_business_id, v_cat_ophtalmologie, 'Chloramphénicol Collyre', 'Gouttes', 0),
  (p_business_id, v_cat_ophtalmologie, 'Timolol Collyre', 'Gouttes', 0);

  -- Dermatologie
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_dermatologie, 'Bétadine', 'Solution', 0),
  (p_business_id, v_cat_dermatologie, 'Crème Hydrocortisone', 'Crème', 0),
  (p_business_id, v_cat_dermatologie, 'Bétaméthasone', 'Crème', 0),
  (p_business_id, v_cat_dermatologie, 'Crème Clotrimazole', 'Crème', 0),
  (p_business_id, v_cat_dermatologie, 'Crème Kétoconazole', 'Crème', 0),
  (p_business_id, v_cat_dermatologie, 'Pommade Antibiotique', 'Pommade', 0),
  (p_business_id, v_cat_dermatologie, 'Vaseline', 'Pommade', 0);

  -- Hospitalier
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_hospitalier, 'Sérum Physiologique 0.9%', 'Perfusion', 0),
  (p_business_id, v_cat_hospitalier, 'Ringer Lactate', 'Perfusion', 0),
  (p_business_id, v_cat_hospitalier, 'Glucose 5%', 'Perfusion', 0),
  (p_business_id, v_cat_hospitalier, 'Glucose 10%', 'Perfusion', 0),
  (p_business_id, v_cat_hospitalier, 'Eau Distillée', 'Solution', 0),
  (p_business_id, v_cat_hospitalier, 'Alcool 70%', 'Solution', 0),
  (p_business_id, v_cat_hospitalier, 'Eau Oxygénée', 'Solution', 0);

  -- Consommables Médicaux
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_consommables, 'Gants Médicaux', 'Pièce', 0),
  (p_business_id, v_cat_consommables, 'Compresses Stériles', 'Pièce', 0),
  (p_business_id, v_cat_consommables, 'Seringues 5ml', 'Pièce', 0),
  (p_business_id, v_cat_consommables, 'Seringues 10ml', 'Pièce', 0),
  (p_business_id, v_cat_consommables, 'Cathéter IV', 'Pièce', 0);

  -- Pédiatrie
  INSERT INTO public.pharmacy_products (business_id, category_id, name, form, total_stock_quantity) VALUES
  (p_business_id, v_cat_pediatrie, 'Lait Infantile', 'Boîte', 0),
  (p_business_id, v_cat_pediatrie, 'Solution de Réhydratation Orale', 'Sachet', 0),
  (p_business_id, v_cat_pediatrie, 'Paracétamol Enfant', 'Sirop', 0),
  (p_business_id, v_cat_pediatrie, 'Ibuprofène Enfant', 'Sirop', 0),
  (p_business_id, v_cat_pediatrie, 'Vitamine D Bébé', 'Gouttes', 0);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_standard_pharmacy_catalog(UUID) TO anon, authenticated, service_role;

-- ─── 2. Seed catalog for all existing businesses ───
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.businesses
  LOOP
    PERFORM public.import_standard_pharmacy_catalog(r.id);
  END LOOP;
END $$;
