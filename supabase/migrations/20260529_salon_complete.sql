-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS: SALON DE BEAUTÉ MODULE - COMPLETE SCHEMA
-- All tables, enums, indexes, triggers, and RLS policies
-- Safe to run (uses IF NOT EXISTS / CREATE OR REPLACE)
-- ════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════════════
-- ENUMS (safe creation via DO block)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE salon_appointment_status AS ENUM ('pending','confirmed','in_progress','completed','no_show','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE salon_employee_role AS ENUM ('owner','manager','barber','stylist','nail_technician','massage_therapist','receptionist');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE salon_payment_method AS ENUM ('cash','moncash','natcash','card');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE salon_inventory_movement_type AS ENUM ('purchase','sale','adjustment','damage','return','transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SALON BRANCHES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Haiti',
  currency_code VARCHAR(3) DEFAULT 'HTG',
  timezone VARCHAR(50) DEFAULT 'America/Port-au-Prince',
  opening_time TIME DEFAULT '09:00:00',
  closing_time TIME DEFAULT '18:00:00',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. SERVICE CATEGORIES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, name)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. SERVICES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  category_id UUID REFERENCES salon_service_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_htg DECIMAL(10, 2) NOT NULL,
  price_currency VARCHAR(3) DEFAULT 'HTG',
  commission_percentage DECIMAL(5, 2) DEFAULT 0,
  requires_employee BOOLEAN DEFAULT true,
  requires_product_list JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. EMPLOYEES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role salon_employee_role NOT NULL DEFAULT 'stylist',
  commission_percentage DECIMAL(5, 2) DEFAULT 0,
  hire_date DATE,
  hourly_rate DECIMAL(10, 2),
  base_salary DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CUSTOMERS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  birthday DATE,
  gender VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  loyalty_points INTEGER DEFAULT 0,
  total_spent DECIMAL(12, 2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. APPOINTMENTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES salon_customers(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  service_id UUID NOT NULL REFERENCES salon_services(id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status salon_appointment_status DEFAULT 'pending',
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PRODUCTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2),
  quantity_in_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  barcode VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. BEVERAGES (with special case/unit logic)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_beverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  unit_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2),
  units_per_case INTEGER NOT NULL DEFAULT 24,
  stock_cases INTEGER DEFAULT 0,
  stock_units INTEGER DEFAULT 0,
  total_units_available INTEGER GENERATED ALWAYS AS (stock_cases * units_per_case + stock_units) STORED,
  reorder_level_units INTEGER DEFAULT 50,
  barcode VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. INVENTORY MOVEMENTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES salon_products(id) ON DELETE SET NULL,
  beverage_id UUID REFERENCES salon_beverages(id) ON DELETE SET NULL,
  movement_type salon_inventory_movement_type NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reason TEXT,
  created_by UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 10. PROMOTIONS & BUNDLES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  promotion_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed_amount', 'bundle', 'combo'
  discount_value DECIMAL(10, 2),
  discount_percentage DECIMAL(5, 2),
  items_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  minimum_quantity INTEGER,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 11. SALES (with sale_number for receipts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES salon_customers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES salon_appointments(id) ON DELETE SET NULL,
  sale_number VARCHAR(50) UNIQUE,
  customer_name VARCHAR(255),
  total_amount DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  payment_method salon_payment_method NOT NULL DEFAULT 'cash',
  payment_status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 12. SALE ITEMS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES salon_sales(id) ON DELETE CASCADE,
  service_id UUID REFERENCES salon_services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES salon_products(id) ON DELETE SET NULL,
  beverage_id UUID REFERENCES salon_beverages(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 13. CASH REGISTERS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  opening_amount DECIMAL(12, 2) DEFAULT 0,
  closing_amount DECIMAL(12, 2),
  expected_amount DECIMAL(12, 2),
  variance_amount DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 14. EXPENSES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salon_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method salon_payment_method,
  created_by UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 15. EXPENSE CATEGORIES
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- 16. EMPLOYEE ATTENDANCE
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- SEQUENCE for auto-incrementing sale numbers
-- ════════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS salon_sale_number_seq START 1;

-- ════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_salon_branches_business_id ON salon_branches(business_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_branch_id ON salon_services(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_category_id ON salon_services(category_id);
CREATE INDEX IF NOT EXISTS idx_salon_employees_branch_id ON salon_employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_employees_auth_user_id ON salon_employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_salon_customers_branch_id ON salon_customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_customers_phone ON salon_customers(phone);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_branch_id ON salon_appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_customer_id ON salon_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_employee_id ON salon_appointments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_date ON salon_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_salon_appointments_status ON salon_appointments(status);
CREATE INDEX IF NOT EXISTS idx_salon_products_branch_id ON salon_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_products_sku ON salon_products(sku);
CREATE INDEX IF NOT EXISTS idx_salon_beverages_branch_id ON salon_beverages(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_beverages_sku ON salon_beverages(sku);
CREATE INDEX IF NOT EXISTS idx_salon_inventory_branch_id ON salon_inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_inventory_product_id ON salon_inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_salon_sales_branch_id ON salon_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_sales_customer_id ON salon_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_salon_sales_created_at ON salon_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_salon_sale_items_sale_id ON salon_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_salon_expenses_branch_id ON salon_expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_salon_expenses_created_at ON salon_expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_salon_promotions_valid_dates ON salon_promotions(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_salon_attendance_employee_date ON salon_employee_attendance(employee_id, date);

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at for salon_branches
CREATE OR REPLACE FUNCTION update_salon_branches_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_salon_branches_updated_at ON salon_branches;
CREATE TRIGGER trigger_update_salon_branches_updated_at
  BEFORE UPDATE ON salon_branches FOR EACH ROW EXECUTE FUNCTION update_salon_branches_updated_at();

-- Auto-update updated_at for salon_services
CREATE OR REPLACE FUNCTION update_salon_services_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_salon_services_updated_at ON salon_services;
CREATE TRIGGER trigger_update_salon_services_updated_at
  BEFORE UPDATE ON salon_services FOR EACH ROW EXECUTE FUNCTION update_salon_services_updated_at();

-- Auto-update updated_at for salon_employees
CREATE OR REPLACE FUNCTION update_salon_employees_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_salon_employees_updated_at ON salon_employees;
CREATE TRIGGER trigger_update_salon_employees_updated_at
  BEFORE UPDATE ON salon_employees FOR EACH ROW EXECUTE FUNCTION update_salon_employees_updated_at();

-- Auto-update updated_at for salon_customers
CREATE OR REPLACE FUNCTION update_salon_customers_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_salon_customers_updated_at ON salon_customers;
CREATE TRIGGER trigger_update_salon_customers_updated_at
  BEFORE UPDATE ON salon_customers FOR EACH ROW EXECUTE FUNCTION update_salon_customers_updated_at();

-- Auto-generate sale_number on insert
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
  FOR EACH ROW WHEN (NEW.sale_number IS NULL)
  EXECUTE FUNCTION generate_salon_sale_number();

-- Update customer stats when a sale is made
CREATE OR REPLACE FUNCTION update_customer_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE salon_customers
  SET total_spent = total_spent + NEW.total_amount,
      visit_count = visit_count + 1,
      last_visit = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_customer_stats_on_sale ON salon_sales;
CREATE TRIGGER trigger_update_customer_stats_on_sale
  AFTER INSERT ON salon_sales
  FOR EACH ROW WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_stats_on_sale();

-- Auto-convert beverage cases: keep total_units_available in sync
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
  FOR EACH ROW EXECUTE FUNCTION auto_convert_beverage_cases();

-- ════════════════════════════════════════════════════════════════════════════
-- BUSINESS FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Sell beverage units (auto-deduct from cases)
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
  IF v_beverage.stock_units >= v_units_needed THEN
    UPDATE salon_beverages SET stock_units = stock_units - v_units_needed WHERE id = p_beverage_id;
  ELSE
    v_units_needed := v_units_needed - v_beverage.stock_units;
    v_cases_to_open := CEIL(v_units_needed::DECIMAL / v_beverage.units_per_case)::INTEGER;
    UPDATE salon_beverages
    SET stock_cases = stock_cases - v_cases_to_open,
        stock_units = (v_cases_to_open * v_beverage.units_per_case) - v_units_needed
    WHERE id = p_beverage_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'cases_deducted', v_cases_to_open);
END;
$$ LANGUAGE plpgsql;

-- Add beverage stock in cases
CREATE OR REPLACE FUNCTION add_beverage_cases(
  p_beverage_id UUID,
  p_cases INTEGER
) RETURNS JSONB AS $$
BEGIN
  UPDATE salon_beverages SET stock_cases = stock_cases + p_cases WHERE id = p_beverage_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE salon_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_employee_attendance ENABLE ROW LEVEL SECURITY;

-- Basic read policies (enhance with business_id filtering in production)
DO $$ BEGIN
  CREATE POLICY "salon_branches_select" ON salon_branches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_services_select" ON salon_services FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_customers_select" ON salon_customers FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_appointments_select" ON salon_appointments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_products_select" ON salon_products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_beverages_select" ON salon_beverages FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_sales_select" ON salon_sales FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_employees_select" ON salon_employees FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_expenses_select" ON salon_expenses FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_expense_categories_select" ON salon_expense_categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_employee_attendance_select" ON salon_employee_attendance FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Write policies
DO $$ BEGIN
  CREATE POLICY "salon_products_insert" ON salon_products FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_products_update" ON salon_products FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_beverages_insert" ON salon_beverages FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_beverages_update" ON salon_beverages FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_expenses_insert" ON salon_expenses FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_expenses_update" ON salon_expenses FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_promotions_insert" ON salon_promotions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_promotions_update" ON salon_promotions FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_sales_insert" ON salon_sales FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "salon_sale_items_insert" ON salon_sale_items FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA (sample service categories - uncomment and customize)
-- ════════════════════════════════════════════════════════════════════════════

-- INSERT INTO salon_expense_categories (branch_id, name, icon, sort_order)
-- SELECT id, 'Loyer', 'building', 1 FROM salon_branches WHERE name = 'Default'
-- UNION ALL SELECT id, 'Électricité', 'lightbulb', 2 FROM salon_branches WHERE name = 'Default'
-- UNION ALL SELECT id, 'Fournitures', 'shopping-cart', 3 FROM salon_branches WHERE name = 'Default'
-- UNION ALL SELECT id, 'Salaires', 'users', 4 FROM salon_branches WHERE name = 'Default'
-- UNION ALL SELECT id, 'Marketing', 'trending-up', 5 FROM salon_branches WHERE name = 'Default';
