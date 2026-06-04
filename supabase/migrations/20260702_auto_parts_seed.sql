-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS SEED DATA
-- ════════════════════════════════════════════════════════════════════════════

-- ─── CATEGORIES ───
INSERT INTO public.auto_parts_categories (name, description, icon, sort_order) VALUES
  ('Moteur', 'Pièces moteur et composants internes', 'Engine', 1),
  ('Transmission', 'Boîte de vitesses, embrayage et composants', 'Armchair', 2),
  ('Freinage', 'Système de freinage et composants', 'CircleStop', 3),
  ('Suspension', 'Système de suspension et amortissement', 'ArrowUpDown', 4),
  ('Direction', 'Système de direction et composants', 'ArrowLeftRight', 5),
  ('Refroidissement', 'Système de refroidissement moteur', 'Thermometer', 6),
  ('Climatisation', 'Système HVAC et climatisation', 'Wind', 7),
  ('Carrosserie', 'Pièces de carrosserie et tôlerie', 'Car', 8),
  ('Électricité', 'Composants électriques et électroniques', 'Zap', 9),
  ('Éclairage', 'Phares, feux et éclairage', 'Sun', 10),
  ('Échappement', 'Système d''échappement', 'ArrowBigUp', 11),
  ('Batteries', 'Batteries et accessoires', 'BatteryCharging', 12),
  ('Pneus', 'Pneus toutes saisons et utilitaires', 'Circle', 13),
  ('Jantes', 'Jantes acier et aluminium', 'CircleDot', 14),
  ('Filtres', 'Filtres à huile, air, carburant, habitacle', 'Filter', 15),
  ('Huiles et Lubrifiants', 'Huiles moteur, transmission et fluides', 'Droplets', 16),
  ('Accessoires', 'Accessoires auto divers', 'Package', 17),
  ('Outillage', 'Outils mécaniques et diagnostiques', 'Wrench', 18),
  ('Audio Automobile', 'Systèmes audio et haut-parleurs', 'Speaker', 19),
  ('Sécurité', 'Équipements de sécurité', 'Shield', 20)
ON CONFLICT DO NOTHING;

-- ─── VEHICLE BRANDS ───
INSERT INTO public.auto_parts_brands (name) VALUES
  ('Toyota'), ('Honda'), ('Nissan'), ('Hyundai'), ('Kia'),
  ('Ford'), ('Chevrolet'), ('Mazda'), ('Mitsubishi'), ('Suzuki'),
  ('Volkswagen'), ('BMW'), ('Mercedes-Benz'), ('Audi'), ('Jeep'), ('Isuzu')
ON CONFLICT DO NOTHING;

-- ─── VEHICLE MODELS ───
WITH brand AS (SELECT id, name FROM public.auto_parts_brands)
INSERT INTO public.auto_parts_models (brand_id, name, start_year, end_year) 
SELECT b.id, m.name, m.start_year, m.end_year
FROM (VALUES
  ('Toyota', 'Corolla', 2000, 2026), ('Toyota', 'Yaris', 2000, 2026), ('Toyota', 'Hilux', 2000, 2026),
  ('Toyota', 'Camry', 2000, 2026), ('Toyota', 'RAV4', 2000, 2026), ('Toyota', 'Land Cruiser', 2000, 2026),
  ('Toyota', 'Prado', 2000, 2026), ('Toyota', 'Fortuner', 2005, 2026), ('Toyota', 'Tundra', 2000, 2026),
  ('Toyota', 'Tacoma', 2000, 2026), ('Toyota', 'Avanza', 2003, 2026), ('Toyota', 'Rush', 2006, 2026),
  ('Honda', 'Civic', 2000, 2026), ('Honda', 'Accord', 2000, 2026), ('Honda', 'CR-V', 2000, 2026),
  ('Honda', 'HR-V', 2000, 2026), ('Honda', 'Fit/Jazz', 2000, 2026), ('Honda', 'Pilot', 2003, 2026),
  ('Honda', 'Odyssey', 2000, 2026), ('Nissan', 'Sentra', 2000, 2026), ('Nissan', 'Altima', 2000, 2026),
  ('Nissan', 'Frontier', 2000, 2026), ('Nissan', 'Pathfinder', 2000, 2026), ('Nissan', 'X-Trail', 2001, 2026),
  ('Nissan', 'Navara', 2000, 2026), ('Nissan', 'March', 2000, 2026), ('Hyundai', 'Elantra', 2000, 2026),
  ('Hyundai', 'Tucson', 2004, 2026), ('Hyundai', 'Santa Fe', 2001, 2026), ('Hyundai', 'Accent', 2000, 2026),
  ('Hyundai', 'Sonata', 2000, 2026), ('Kia', 'Sportage', 2000, 2026), ('Kia', 'Sorento', 2002, 2026),
  ('Kia', 'Rio', 2000, 2026), ('Kia', 'Cerato', 2004, 2026), ('Ford', 'Ranger', 2000, 2026),
  ('Ford', 'Explorer', 2000, 2026), ('Ford', 'Escape', 2000, 2026), ('Ford', 'Focus', 2000, 2026),
  ('Ford', 'F-150', 2000, 2026), ('Chevrolet', 'Spark', 2000, 2026), ('Chevrolet', 'Captiva', 2006, 2026),
  ('Chevrolet', 'Silverado', 2000, 2026), ('Chevrolet', 'Trailblazer', 2000, 2026), ('Chevrolet', 'Onix', 2012, 2026),
  ('Mazda', 'Mazda3', 2000, 2026), ('Mazda', 'Mazda6', 2002, 2026), ('Mazda', 'CX-5', 2012, 2026),
  ('Mazda', 'CX-9', 2007, 2026), ('Mitsubishi', 'L200', 2000, 2026), ('Mitsubishi', 'Montero', 2000, 2026),
  ('Mitsubishi', 'Outlander', 2003, 2026), ('Mitsubishi', 'Lancer', 2000, 2026),
  ('Suzuki', 'Swift', 2000, 2026), ('Suzuki', 'Vitara', 2000, 2026), ('Suzuki', 'Jimny', 2000, 2026),
  ('Suzuki', 'Grand Vitara', 2000, 2026), ('Volkswagen', 'Golf', 2000, 2026), ('Volkswagen', 'Passat', 2000, 2026),
  ('Volkswagen', 'Tiguan', 2007, 2026), ('Volkswagen', 'Amarok', 2010, 2026),
  ('BMW', 'Série 3', 2000, 2026), ('BMW', 'Série 5', 2000, 2026), ('BMW', 'X3', 2003, 2026),
  ('BMW', 'X5', 2000, 2026), ('Mercedes-Benz', 'Classe C', 2000, 2026), ('Mercedes-Benz', 'Classe E', 2000, 2026),
  ('Mercedes-Benz', 'Classe G', 2000, 2026), ('Mercedes-Benz', 'GLC', 2015, 2026),
  ('Audi', 'A3', 2000, 2026), ('Audi', 'A4', 2000, 2026), ('Audi', 'Q5', 2008, 2026),
  ('Audi', 'Q7', 2006, 2026), ('Jeep', 'Wrangler', 2000, 2026), ('Jeep', 'Cherokee', 2000, 2026),
  ('Jeep', 'Grand Cherokee', 2000, 2026), ('Jeep', 'Compass', 2006, 2026),
  ('Isuzu', 'D-Max', 2000, 2026), ('Isuzu', 'MU-X', 2013, 2026)
) AS m(brand_name, name, start_year, end_year)
JOIN brand b ON b.name = m.brand_name
ON CONFLICT DO NOTHING;

-- ─── PRODUCTS ───
WITH cat AS (SELECT id, name FROM public.auto_parts_categories)
INSERT INTO public.auto_parts_products (name, description, category_id, unit_price, cost_price, stock_quantity, min_stock, active)
SELECT p.name, p.description, c.id, p.price, p.cost, p.stock, p.min, true
FROM (VALUES
  -- MOTEUR
  ('Piston', 'Piston moteur standard', 'Moteur', 2500, 1800, 0, 5),
  ('Segment', 'Jeu de segments de piston', 'Moteur', 800, 500, 0, 10),
  ('Bielle', 'Bielle de connexion moteur', 'Moteur', 3500, 2500, 0, 5),
  ('Vilebrequin', 'Vilebrequin moteur', 'Moteur', 15000, 10000, 0, 2),
  ('Arbre à cames', 'Arbre à cames moteur', 'Moteur', 8000, 5500, 0, 3),
  ('Culasse', 'Culasse moteur complète', 'Moteur', 12000, 8000, 0, 2),
  ('Joint de culasse', 'Joint de culasse moteur', 'Moteur', 1500, 900, 0, 10),
  ('Pompe à huile', 'Pompe à huile moteur', 'Moteur', 4500, 3000, 0, 5),
  ('Carter moteur', 'Carter d''huile moteur', 'Moteur', 3000, 2000, 0, 3),
  ('Soupape admission', 'Soupape d''admission', 'Moteur', 600, 400, 0, 10),
  ('Soupape échappement', 'Soupape d''échappement', 'Moteur', 600, 400, 0, 10),
  ('Chaîne distribution', 'Chaîne de distribution complète', 'Moteur', 5000, 3500, 0, 5),
  ('Courroie distribution', 'Courroie de distribution', 'Moteur', 2500, 1500, 0, 8),
  ('Galet tendeur', 'Galet tendeur de distribution', 'Moteur', 3500, 2200, 0, 5),
  ('Coussinet moteur', 'Jeu de coussinets moteur', 'Moteur', 1800, 1200, 0, 8),
  ('Joint spi vilebrequin', 'Joint spi avant/arrière vilebrequin', 'Moteur', 400, 250, 0, 10),
  ('Chemise cylindre', 'Chemise de cylindre', 'Moteur', 3000, 2000, 0, 4),
  ('Turbocompresseur', 'Turbo complet', 'Moteur', 35000, 25000, 0, 1),
  ('Injecteur', 'Injecteur carburant', 'Moteur', 5000, 3500, 0, 6),
  ('Pompe injection', 'Pompe à injection diesel', 'Moteur', 25000, 18000, 0, 1),
  -- TRANSMISSION
  ('Kit embrayage', 'Kit embrayage complet (disque+plateau+butée)', 'Transmission', 8500, 5500, 0, 5),
  ('Disque embrayage', 'Disque d''embrayage', 'Transmission', 4000, 2500, 0, 8),
  ('Plateau pression', 'Plateau de pression d''embrayage', 'Transmission', 5000, 3200, 0, 5),
  ('Butée embrayage', 'Butée d''embrayage', 'Transmission', 1200, 700, 0, 10),
  ('Boîte vitesses', 'Boîte de vitesses complète', 'Transmission', 45000, 32000, 0, 1),
  ('Joint homocinétique', 'Joint homocinétique', 'Transmission', 2500, 1500, 0, 8),
  ('Arbre transmission', 'Arbre de transmission', 'Transmission', 8000, 5500, 0, 3),
  ('Différentiel', 'Différentiel complet', 'Transmission', 18000, 12000, 0, 2),
  ('Liquide transmission', 'Huile de transmission ATF', 'Transmission', 1500, 900, 0, 15),
  -- FREINAGE
  ('Plaquette de frein', 'Jeu de plaquettes de frein avant/arrière', 'Freinage', 2500, 1500, 0, 15),
  ('Disque de frein', 'Disque de frein avant/arrière', 'Freinage', 3500, 2200, 0, 10),
  ('Tambour de frein', 'Tambour de frein arrière', 'Freinage', 4000, 2500, 0, 5),
  ('Étrier', 'Étrier de frein complet', 'Freinage', 6000, 4000, 0, 5),
  ('Maître-cylindre', 'Maître-cylindre de frein', 'Freinage', 4500, 3000, 0, 5),
  ('Flexible frein', 'Flexible de frein', 'Freinage', 800, 400, 0, 12),
  ('Liquide frein', 'Liquide de frein DOT 4', 'Freinage', 500, 300, 0, 20),
  ('Sabot frein', 'JEU de sabots de frein', 'Freinage', 2000, 1200, 0, 8),
  -- SUSPENSION
  ('Amortisseur avant', 'Amortisseur avant', 'Suspension', 5000, 3500, 0, 8),
  ('Amortisseur arrière', 'Amortisseur arrière', 'Suspension', 4500, 3200, 0, 8),
  ('Ressort suspension', 'Ressort de suspension', 'Suspension', 3000, 2000, 0, 6),
  ('Rotule suspension', 'Rotule de suspension', 'Suspension', 1500, 900, 0, 10),
  ('Bras suspension', 'Bras de suspension complet', 'Suspension', 6000, 4000, 0, 5),
  ('Barre stabilisatrice', 'Barre stabilisatrice', 'Suspension', 3500, 2200, 0, 4),
  ('Silentbloc', 'Silentbloc de suspension', 'Suspension', 500, 250, 0, 20),
  ('Soufflet suspension', 'Soufflet de protection amortisseur', 'Suspension', 400, 200, 0, 12),
  -- DIRECTION
  ('Crémaillère direction', 'Crémaillère de direction complète', 'Direction', 12000, 8000, 0, 3),
  ('Rotule direction', 'Rotule de direction', 'Direction', 1500, 900, 0, 10),
  ('Pompe direction assistée', 'Pompe de direction assistée', 'Direction', 8000, 5500, 0, 4),
  ('Colonne direction', 'Colonne de direction', 'Direction', 6000, 4000, 0, 3),
  ('Biellette direction', 'Biellette de direction', 'Direction', 1200, 700, 0, 10),
  ('Liquide direction', 'Huile de direction assistée', 'Direction', 600, 350, 0, 15),
  -- REFROIDISSEMENT
  ('Radiateur', 'Radiateur de refroidissement', 'Refroidissement', 8000, 5500, 0, 5),
  ('Ventilateur radiateur', 'Ventilateur électrique radiateur', 'Refroidissement', 3500, 2200, 0, 5),
  ('Thermostat', 'Thermostat de refroidissement', 'Refroidissement', 800, 400, 0, 10),
  ('Pompe à eau', 'Pompe à eau moteur', 'Refroidissement', 4000, 2500, 0, 8),
  ('Vase expansion', 'Vase d''expansion liquide refroidissement', 'Refroidissement', 1500, 900, 0, 6),
  ('Durite radiateur', 'Durite de radiateur', 'Refroidissement', 600, 300, 0, 12),
  ('Liquide refroidissement', 'Liquide de refroidissement concentré', 'Refroidissement', 800, 400, 0, 20),
  -- CLIMATISATION
  ('Compresseur climatisation', 'Compresseur de climatisation', 'Climatisation', 25000, 18000, 0, 2),
  ('Condenseur', 'Condenseur de climatisation', 'Climatisation', 8000, 5500, 0, 4),
  ('Évaporateur', 'Évaporateur de climatisation', 'Climatisation', 6000, 4000, 0, 4),
  ('Ventilateur habitacle', 'Ventilateur d''habitacle', 'Climatisation', 2500, 1500, 0, 5),
  ('Gaz réfrigérant', 'Gaz réfrigérant R134a', 'Climatisation', 2000, 1200, 0, 15),
  ('Filtre habitacle', 'Filtre d''habitacle', 'Climatisation', 600, 300, 0, 20),
  -- ÉLECTRICITÉ
  ('Alternateur', 'Alternateur complet', 'Électricité', 12000, 8000, 0, 4),
  ('Démarreur', 'Démarreur moteur', 'Électricité', 8000, 5500, 0, 5),
  ('Bobine allumage', 'Bobine d''allumage', 'Électricité', 2500, 1500, 0, 8),
  ('Bougie allumage', 'Bougie d''allumage', 'Électricité', 400, 200, 0, 30),
  ('Relais', 'Relais électrique 12V', 'Électricité', 200, 100, 0, 30),
  ('Fusible', 'Fusible automobile (lot de 10)', 'Électricité', 150, 80, 0, 50),
  ('Batterie', 'Batterie 12V 60Ah', 'Électricité', 8500, 5500, 0, 8),
  ('Capteur', 'Capteur divers (ABS, pression, etc.)', 'Électricité', 3000, 1800, 0, 6),
  ('Faisceau électrique', 'Faisceau électrique', 'Électricité', 5000, 3200, 0, 3),
  -- ÉCLAIRAGE
  ('Phare avant', 'Phare avant complet', 'Éclairage', 8000, 5000, 0, 5),
  ('Feu arrière', 'Feu arrière complet', 'Éclairage', 4500, 2800, 0, 5),
  ('Clignotant', 'Clignotant avant/arrière', 'Éclairage', 1500, 800, 0, 10),
  ('Feu stop', 'Feu stop', 'Éclairage', 1200, 700, 0, 10),
  ('Ampoule LED', 'Ampoule LED 12V', 'Éclairage', 300, 150, 0, 30),
  ('Projecteur antibrouillard', 'Projecteur antibrouillard', 'Éclairage', 3500, 2000, 0, 5),
  ('Feu de recul', 'Feu de recul', 'Éclairage', 1000, 500, 0, 8),
  -- CARROSSERIE
  ('Pare-chocs avant', 'Pare-chocs avant complet', 'Carrosserie', 15000, 10000, 0, 2),
  ('Pare-chocs arrière', 'Pare-chocs arrière complet', 'Carrosserie', 12000, 8000, 0, 2),
  ('Capot', 'Capot moteur', 'Carrosserie', 20000, 14000, 0, 2),
  ('Aile avant', 'Aile avant', 'Carrosserie', 8000, 5000, 0, 3),
  ('Aile arrière', 'Aile arrière', 'Carrosserie', 7000, 4500, 0, 3),
  ('Porte', 'Porte latérale complète', 'Carrosserie', 15000, 10000, 0, 2),
  ('Rétroviseur', 'Rétroviseur extérieur', 'Carrosserie', 3000, 1800, 0, 8),
  ('Pare-brise', 'Pare-brise avant', 'Carrosserie', 12000, 8000, 0, 3),
  ('Calandre', 'Calandre avant', 'Carrosserie', 4000, 2500, 0, 4),
  ('Poignée porte', 'Poignée de porte extérieure', 'Carrosserie', 800, 400, 0, 10),
  -- ÉCHAPPEMENT
  ('Collecteur échappement', 'Collecteur d''échappement', 'Échappement', 6000, 4000, 0, 4),
  ('Catalyseur', 'Pot catalytique', 'Échappement', 15000, 10000, 0, 3),
  ('Silencieux', 'Silencieux arrière', 'Échappement', 5000, 3200, 0, 5),
  ('Tube échappement', 'Tube d''échappement', 'Échappement', 3000, 1800, 0, 6),
  ('Joint échappement', 'Joint d''échappement', 'Échappement', 300, 150, 0, 15),
  ('Sonde lambda', 'Sonde à oxygène', 'Échappement', 4500, 3000, 0, 5),
  -- PNEUS
  ('Pneu tourisme', 'Pneu tourisme 195/65R15', 'Pneus', 8000, 5500, 0, 10),
  ('Pneu SUV', 'Pneu SUV 225/65R17', 'Pneus', 12000, 8000, 0, 8),
  ('Pneu camion', 'Pneu camionnette LT', 'Pneus', 15000, 10000, 0, 5),
  ('Pneu hiver', 'Pneu hiver', 'Pneus', 10000, 7000, 0, 5),
  ('Chambre à air', 'Chambre à air universelle', 'Pneus', 500, 250, 0, 20),
  -- JANTES
  ('Jante aluminium', 'Jante alu 15 pouces', 'Jantes', 12000, 8000, 0, 5),
  ('Jante acier', 'Jante acier 15 pouces', 'Jantes', 5000, 3000, 0, 8),
  ('Enjoliveur', 'Enjoliveur', 'Jantes', 1000, 500, 0, 10),
  ('Écrou jante', 'Lot écrous de jante', 'Jantes', 300, 150, 0, 20),
  -- FILTRES
  ('Filtre à huile', 'Filtre à huile moteur', 'Filtres', 400, 200, 0, 30),
  ('Filtre à air', 'Filtre à air moteur', 'Filtres', 600, 300, 0, 25),
  ('Filtre carburant', 'Filtre à carburant', 'Filtres', 500, 250, 0, 20),
  ('Filtre habitacle', 'Filtre d''habitacle', 'Filtres', 800, 400, 0, 20),
  ('Filtre huile transmission', 'Filtre d''huile transmission', 'Filtres', 1500, 900, 0, 10),
  -- HUILES ET LUBRIFIANTS
  ('Huile moteur 10W40', 'Huile moteur 10W40 5L', 'Huiles et Lubrifiants', 2500, 1500, 0, 15),
  ('Huile moteur 20W50', 'Huile moteur 20W50 5L', 'Huiles et Lubrifiants', 2200, 1300, 0, 15),
  ('Huile moteur 5W30', 'Huile moteur 5W30 5L', 'Huiles et Lubrifiants', 3000, 1800, 0, 12),
  ('Huile transmission', 'Huile de transmission 80W90 1L', 'Huiles et Lubrifiants', 800, 400, 0, 15),
  ('Liquide frein DOT4', 'Liquide de frein DOT4 500ml', 'Huiles et Lubrifiants', 500, 250, 0, 20),
  ('Liquide refroidissement', 'Liquide refroidissement concentré 5L', 'Huiles et Lubrifiants', 1200, 600, 0, 15),
  ('Graisse multipurpose', 'Graisse multiusage 400g', 'Huiles et Lubrifiants', 600, 300, 0, 15),
  ('Huile direction assistée', 'Huile direction assistée 1L', 'Huiles et Lubrifiants', 700, 350, 0, 12),
  -- ACCESSOIRES
  ('Tapis de sol', 'Jeu de tapis de sol universel', 'Accessoires', 1500, 800, 0, 10),
  ('Housse siège', 'Housse de siège auto universelle', 'Accessoires', 2000, 1000, 0, 8),
  ('Volant', 'Volant direction sport', 'Accessoires', 4000, 2500, 0, 5),
  ('Levier vitesse', 'Pommeau levier de vitesse', 'Accessoires', 500, 250, 0, 10),
  ('Cache-bagages', 'Cache-bagages', 'Accessoires', 3000, 1800, 0, 5),
  ('Support téléphone', 'Support téléphone voiture', 'Accessoires', 500, 200, 0, 15),
  ('Chargeur USB', 'Chargeur USB voiture', 'Accessoires', 400, 150, 0, 15),
  ('Antivol volant', 'Antivol de volant', 'Accessoires', 2500, 1500, 0, 8),
  ('Câble batterie', 'Câble de démarrage batterie', 'Accessoires', 1500, 800, 0, 8),
  -- OUTILLAGE
  ('Cric hydraulique', 'Cric hydraulique 2 tonnes', 'Outillage', 5000, 3000, 0, 5),
  ('Chandelle sécurité', 'Chandelle de sécurité (paire)', 'Outillage', 4000, 2500, 0, 5),
  ('Clé dynamométrique', 'Clé dynamométrique', 'Outillage', 6000, 4000, 0, 3),
  ('Jeu douilles', 'Coffret douilles 1/2 pouce', 'Outillage', 4500, 2800, 0, 5),
  ('Jeu clés plates', 'Jeu de clés plates', 'Outillage', 3000, 1800, 0, 5),
  ('Tournevis set', 'Jeu de tournevis', 'Outillage', 1500, 800, 0, 8),
  ('Pince multiprise', 'Pince multiprise', 'Outillage', 800, 400, 0, 10),
  ('Multimètre', 'Multimètre numérique', 'Outillage', 2000, 1200, 0, 5),
  ('Dépanneur batterie', 'Chargeur/dépanneur batterie', 'Outillage', 5000, 3000, 0, 3),
  ('Extracteur', 'Extracteur universel', 'Outillage', 2500, 1500, 0, 4),
  -- AUDIO AUTOMOBILE
  ('Auto-radio', 'Auto-radio Bluetooth USB', 'Audio Automobile', 5000, 3000, 0, 5),
  ('Haut-parleur 16cm', 'HP 16cm 2 voies', 'Audio Automobile', 2500, 1500, 0, 8),
  ('Caisson basses', 'Caisson de basses actif', 'Audio Automobile', 8000, 5000, 0, 3),
  ('Amplificateur', 'Amplificateur 4 canaux', 'Audio Automobile', 6000, 3800, 0, 3),
  ('Antenne radio', 'Antenne radio auto', 'Audio Automobile', 600, 300, 0, 10),
  -- SÉCURITÉ
  ('Extincteur', 'Extincteur 1kg', 'Sécurité', 2500, 1500, 0, 8),
  ('Triangle signalisation', 'Triangle de signalisation', 'Sécurité', 500, 250, 0, 15),
  ('Trousse secourisme', 'Trousse de premiers secours', 'Sécurité', 1500, 800, 0, 10),
  ('Gilet sécurité', 'Gilet de sécurité réfléchissant', 'Sécurité', 400, 200, 0, 20),
  ('Cône signalisation', 'Cône de signalisation', 'Sécurité', 600, 300, 0, 12)
) AS p(name, description, category, price, cost, stock, min)
JOIN cat c ON c.name = p.category
ON CONFLICT DO NOTHING;
