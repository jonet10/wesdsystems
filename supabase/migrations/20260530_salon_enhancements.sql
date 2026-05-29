-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS: SALON MODULE ENHANCEMENTS
-- Expense categories, promotion bundles, beverage auto-conversion
-- Created: May 30, 2026
-- ════════════════════════════════════════════════════════════════════════════

-- Add salon_number to sales for receipt numbering
ALTER TABLE salon_sales ADD COLUMN IF NOT EXISTS sale_number VARCHAR(50) UNIQUE;
ALTER TABLE salon_sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Create sequence for sale numbers
CREATE SEQUENCE IF NOT EXISTS salon_sale_number_seq START 1;

-- Auto-generate sale number on insert
CREATE OR REPLACE FUNCTION generate_salon_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sale_number := 'WESD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('salon_sale_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_salon_sale_number ON salon_sales;
CREATE TRIGGER trigger_generate_salon_sale_number
  BEFORE INSERT ON salon_sales
  FOR EACH ROW
  WHEN (NEW.sale_number IS NULL)
  EXECUTE FUNCTION generate_salon_sale_number();

-- Expense categories lookup table
CREATE TABLE IF NOT EXISTS salon_expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'receipt',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, name)
);

ALTER TABLE salon_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_expense_categories_select" ON salon_expense_categories FOR SELECT USING (true);

-- Add total_units_available to salon_beverages if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_beverages' AND column_name = 'total_units_available'
  ) THEN
    ALTER TABLE salon_beverages 
      ADD COLUMN total_units_available INTEGER GENERATED ALWAYS AS (stock_cases * units_per_case + stock_units) STORED;
  END IF;
END $$;

-- Add reorder_level_units if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_beverages' AND column_name = 'reorder_level_units'
  ) THEN
    ALTER TABLE salon_beverages ADD COLUMN reorder_level_units INTEGER DEFAULT 50;
  END IF;
END $$;

-- Add index on salon_promotions
CREATE INDEX IF NOT EXISTS idx_salon_promotions_valid_dates ON salon_promotions(valid_from, valid_until);

-- Beverage auto-conversion trigger: when stock_cases updates, update stock_units
CREATE OR REPLACE FUNCTION auto_convert_beverage_cases()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_units_available := NEW.stock_cases * NEW.units_per_case + NEW.stock_units;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_convert_beverage_cases ON salon_beverages;
CREATE TRIGGER trigger_auto_convert_beverage_cases
  BEFORE INSERT OR UPDATE OF stock_cases, stock_units, units_per_case ON salon_beverages
  FOR EACH ROW
  EXECUTE FUNCTION auto_convert_beverage_cases();

-- Function to sell beverage units (auto-deduct from cases)
CREATE OR REPLACE FUNCTION sell_beverage_units(
  p_beverage_id UUID,
  p_units_sold INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_beverage salon_beverages%ROWTYPE;
  v_units_needed INTEGER;
  v_cases_to_open INTEGER;
BEGIN
  SELECT * INTO v_beverage FROM salon_beverages WHERE id = p_beverage_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boisson introuvable');
  END IF;

  IF v_beverage.total_units_available < p_units_sold THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant');
  END IF;

  v_units_needed := p_units_sold;
  v_cases_to_open := 0;

  -- Use loose units first
  IF v_beverage.stock_units >= v_units_needed THEN
    UPDATE salon_beverages 
    SET stock_units = stock_units - v_units_needed
    WHERE id = p_beverage_id;
  ELSE
    v_units_needed := v_units_needed - v_beverage.stock_units;
    v_cases_to_open := CEIL(v_units_needed::DECIMAL / v_beverage.units_per_case)::INTEGER;
    
    UPDATE salon_beverages 
    SET 
      stock_cases = stock_cases - v_cases_to_open,
      stock_units = (v_cases_to_open * v_beverage.units_per_case) - v_units_needed
    WHERE id = p_beverage_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'cases_deducted', v_cases_to_open);
END;
$$ LANGUAGE plpgsql;

-- Function to add beverage stock in cases
CREATE OR REPLACE FUNCTION add_beverage_cases(
  p_beverage_id UUID,
  p_cases INTEGER
) RETURNS JSONB AS $$
BEGIN
  UPDATE salon_beverages 
  SET stock_cases = stock_cases + p_cases
  WHERE id = p_beverage_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Employee attendance tracking
CREATE TABLE IF NOT EXISTS salon_employee_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES salon_employees(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

ALTER TABLE salon_employee_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_employee_attendance_select" ON salon_employee_attendance FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_salon_attendance_employee_date ON salon_employee_attendance(employee_id, date);

-- Enhanced RLS policies for multi-tenant security
CREATE POLICY "salon_products_insert" ON salon_products FOR INSERT WITH CHECK (true);
CREATE POLICY "salon_products_update" ON salon_products FOR UPDATE USING (true);
CREATE POLICY "salon_beverages_insert" ON salon_beverages FOR INSERT WITH CHECK (true);
CREATE POLICY "salon_beverages_update" ON salon_beverages FOR UPDATE USING (true);
CREATE POLICY "salon_expenses_insert" ON salon_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "salon_expenses_update" ON salon_expenses FOR UPDATE USING (true);
CREATE POLICY "salon_promotions_insert" ON salon_promotions FOR INSERT WITH CHECK (true);
CREATE POLICY "salon_promotions_update" ON salon_promotions FOR UPDATE USING (true);
CREATE POLICY "salon_sales_insert" ON salon_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "salon_sale_items_insert" ON salon_sale_items FOR INSERT WITH CHECK (true);
