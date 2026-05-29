-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS: SALON DE BEAUTÉ MODULE
-- Complete database schema for beauty salon management
-- Created: May 29, 2026
-- ════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE salon_appointment_status AS ENUM (
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'no_show',
  'cancelled'
);

CREATE TYPE salon_employee_role AS ENUM (
  'owner',
  'manager',
  'barber',
  'stylist',
  'nail_technician',
  'massage_therapist',
  'receptionist'
);

CREATE TYPE salon_payment_method AS ENUM (
  'cash',
  'moncash',
  'natcash',
  'card'
);

CREATE TYPE salon_inventory_movement_type AS ENUM (
  'purchase',
  'sale',
  'adjustment',
  'damage',
  'return',
  'transfer'
);

-- ════════════════════════════════════════════════════════════════════════════
-- CORE SALON TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- 1. SALON BRANCHES
CREATE TABLE salon_branches (
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

-- 2. SERVICE CATEGORIES
CREATE TABLE salon_service_categories (
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

-- 3. SERVICES
CREATE TABLE salon_services (
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

-- 4. EMPLOYEES
CREATE TABLE salon_employees (
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

-- 5. CUSTOMERS
CREATE TABLE salon_customers (
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

-- 6. APPOINTMENTS
CREATE TABLE salon_appointments (
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

-- 7. PRODUCTS
CREATE TABLE salon_products (
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

-- 8. BEVERAGES (with special case/unit logic)
CREATE TABLE salon_beverages (
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

-- 9. INVENTORY MOVEMENTS
CREATE TABLE salon_inventory_movements (
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

-- 10. PROMOTIONS & BUNDLES
CREATE TABLE salon_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  promotion_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed_amount', 'bundle', 'combo'
  discount_value DECIMAL(10, 2),
  discount_percentage DECIMAL(5, 2),
  items_config JSONB NOT NULL, -- {"services": [...], "products": [...], "beverages": [...]}
  minimum_quantity INTEGER,
  valid_from DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. SALES
CREATE TABLE salon_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES salon_customers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES salon_appointments(id) ON DELETE SET NULL,
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

-- 12. SALE ITEMS
CREATE TABLE salon_sale_items (
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

-- 13. CASH REGISTERS
CREATE TABLE salon_cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES salon_branches(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES salon_employees(id) ON DELETE SET NULL,
  opening_amount DECIMAL(12, 2) DEFAULT 0,
  closing_amount DECIMAL(12, 2),
  expected_amount DECIMAL(12, 2),
  variance_amount DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed'
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. EXPENSES
CREATE TABLE salon_expenses (
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
-- INDEXES
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_salon_branches_business_id ON salon_branches(business_id);
CREATE INDEX idx_salon_services_branch_id ON salon_services(branch_id);
CREATE INDEX idx_salon_services_category_id ON salon_services(category_id);
CREATE INDEX idx_salon_employees_branch_id ON salon_employees(branch_id);
CREATE INDEX idx_salon_employees_auth_user_id ON salon_employees(auth_user_id);
CREATE INDEX idx_salon_customers_branch_id ON salon_customers(branch_id);
CREATE INDEX idx_salon_customers_phone ON salon_customers(phone);
CREATE INDEX idx_salon_appointments_branch_id ON salon_appointments(branch_id);
CREATE INDEX idx_salon_appointments_customer_id ON salon_appointments(customer_id);
CREATE INDEX idx_salon_appointments_employee_id ON salon_appointments(employee_id);
CREATE INDEX idx_salon_appointments_date ON salon_appointments(appointment_date);
CREATE INDEX idx_salon_appointments_status ON salon_appointments(status);
CREATE INDEX idx_salon_products_branch_id ON salon_products(branch_id);
CREATE INDEX idx_salon_products_sku ON salon_products(sku);
CREATE INDEX idx_salon_beverages_branch_id ON salon_beverages(branch_id);
CREATE INDEX idx_salon_beverages_sku ON salon_beverages(sku);
CREATE INDEX idx_salon_inventory_branch_id ON salon_inventory_movements(branch_id);
CREATE INDEX idx_salon_inventory_product_id ON salon_inventory_movements(product_id);
CREATE INDEX idx_salon_sales_branch_id ON salon_sales(branch_id);
CREATE INDEX idx_salon_sales_customer_id ON salon_sales(customer_id);
CREATE INDEX idx_salon_sales_created_at ON salon_sales(created_at);
CREATE INDEX idx_salon_sale_items_sale_id ON salon_sale_items(sale_id);
CREATE INDEX idx_salon_expenses_branch_id ON salon_expenses(branch_id);
CREATE INDEX idx_salon_expenses_created_at ON salon_expenses(created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- Update salon_branches updated_at
CREATE OR REPLACE FUNCTION update_salon_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_salon_branches_updated_at
  BEFORE UPDATE ON salon_branches
  FOR EACH ROW
  EXECUTE FUNCTION update_salon_branches_updated_at();

-- Update salon_services updated_at
CREATE OR REPLACE FUNCTION update_salon_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_salon_services_updated_at
  BEFORE UPDATE ON salon_services
  FOR EACH ROW
  EXECUTE FUNCTION update_salon_services_updated_at();

-- Update salon_employees updated_at
CREATE OR REPLACE FUNCTION update_salon_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_salon_employees_updated_at
  BEFORE UPDATE ON salon_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_salon_employees_updated_at();

-- Update salon_customers updated_at & stats
CREATE OR REPLACE FUNCTION update_salon_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_salon_customers_updated_at
  BEFORE UPDATE ON salon_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_salon_customers_updated_at();

-- Update customer stats on sale
CREATE OR REPLACE FUNCTION update_customer_stats_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE salon_customers
  SET 
    total_spent = total_spent + NEW.total_amount,
    visit_count = visit_count + 1,
    last_visit = NOW()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_stats_on_sale
  AFTER INSERT ON salon_sales
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_stats_on_sale();

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
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

-- Basic RLS policies (to be enhanced with business_id filtering)
CREATE POLICY "salon_branches_select" ON salon_branches FOR SELECT USING (true);
CREATE POLICY "salon_services_select" ON salon_services FOR SELECT USING (true);
CREATE POLICY "salon_customers_select" ON salon_customers FOR SELECT USING (true);
CREATE POLICY "salon_appointments_select" ON salon_appointments FOR SELECT USING (true);
CREATE POLICY "salon_products_select" ON salon_products FOR SELECT USING (true);
CREATE POLICY "salon_beverages_select" ON salon_beverages FOR SELECT USING (true);
CREATE POLICY "salon_sales_select" ON salon_sales FOR SELECT USING (true);
CREATE POLICY "salon_employees_select" ON salon_employees FOR SELECT USING (true);
CREATE POLICY "salon_expenses_select" ON salon_expenses FOR SELECT USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- SEED DATA (Optional - Remove for production)
-- ════════════════════════════════════════════════════════════════════════════

-- Sample service categories
-- INSERT INTO salon_service_categories (branch_id, name, icon, color, sort_order)
-- VALUES 
--   ('barber-services', 'Barber', 'Scissors', 'blue', 1),
--   ('hair-services', 'Coiffure', 'Wind', 'purple', 2),
--   ('nail-services', 'Ongles', 'Sparkles', 'pink', 3),
--   ('massage-services', 'Massage', 'Heart', 'red', 4);
