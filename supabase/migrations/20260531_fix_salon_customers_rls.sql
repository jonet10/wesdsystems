-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Politiques RLS manquantes pour salon_customers
-- Erreur: 403 Forbidden / error=42501
-- ════════════════════════════════════════════════════════════════════════════

-- INSERT
DO $$ BEGIN
  CREATE POLICY "salon_customers_insert" ON salon_customers FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE
DO $$ BEGIN
  CREATE POLICY "salon_customers_update" ON salon_customers FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE
DO $$ BEGIN
  CREATE POLICY "salon_customers_delete" ON salon_customers FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Appliquer les mêmes correctifs aux autres tables potentiellement bloquées ──

-- salon_appointments
DO $$ BEGIN
  CREATE POLICY "salon_appointments_insert" ON salon_appointments FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_appointments_update" ON salon_appointments FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_appointments_delete" ON salon_appointments FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_services
DO $$ BEGIN
  CREATE POLICY "salon_services_insert" ON salon_services FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_services_update" ON salon_services FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_services_delete" ON salon_services FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_employees
DO $$ BEGIN
  CREATE POLICY "salon_employees_insert" ON salon_employees FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_employees_update" ON salon_employees FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_employees_delete" ON salon_employees FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_branches
DO $$ BEGIN
  CREATE POLICY "salon_branches_insert" ON salon_branches FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_branches_update" ON salon_branches FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_inventory_movements
DO $$ BEGIN
  CREATE POLICY "salon_inventory_movements_all" ON salon_inventory_movements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_cash_registers
DO $$ BEGIN
  CREATE POLICY "salon_cash_registers_all" ON salon_cash_registers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- salon_sale_items
DO $$ BEGIN
  CREATE POLICY "salon_sale_items_select" ON salon_sale_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_sale_items_update" ON salon_sale_items FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_sale_items_delete" ON salon_sale_items FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
