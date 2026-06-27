export interface AutoPartsCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  business_id?: string;
  created_at: string;
}

export interface AutoPartsProduct {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  category?: AutoPartsCategory;
  sku?: string;
  barcode?: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  reserved_quantity: number;
  min_stock: number;
  max_stock?: number;
  location?: string;
  image_url?: string;
  notes?: string;
  active: boolean;
  business_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AutoPartsBrand {
  id: string;
  name: string;
  created_at: string;
}

export interface AutoPartsModel {
  id: string;
  brand_id: string;
  brand?: AutoPartsBrand;
  name: string;
  start_year?: number;
  end_year?: number;
  created_at: string;
}

export interface AutoPartsVehicleCompatibility {
  id: string;
  product_id: string;
  brand_id?: string;
  brand?: AutoPartsBrand;
  model_id?: string;
  model?: AutoPartsModel;
  year_start?: number;
  year_end?: number;
  engine?: string;
  notes?: string;
  created_at: string;
}

export interface AutoPartsSupplier {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  country: string;
  currency: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface AutoPartsClient {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  company?: string;
  notes?: string;
  credit_balance?: number;
  created_at: string;
}

export interface AutoPartsStockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  type: 'in' | 'out' | 'adjustment' | 'sale' | 'return';
  quantity: number;
  unit_price?: number;
  reference?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface AutoPartsSale {
  id: string;
  invoice_number: string;
  client_id?: string;
  client_name?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer' | 'moncash' | 'natcash';
  payment_status: 'paid' | 'partial' | 'unpaid';
  staff_id?: string;
  staff_name?: string;
  refund_status?: 'none' | 'partial' | 'full';
  refunded_at?: string;
  notes?: string;
  items?: AutoPartsSaleItem[];
  created_by?: string;
  created_at: string;
}

export interface AutoPartsSaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AutoPartsPurchase {
  id: string;
  supplier_id?: string;
  supplier_name?: string;
  reference_number?: string;
  status: 'draft' | 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  items?: AutoPartsPurchaseItem[];
  created_by?: string;
  created_at: string;
}

export interface AutoPartsPurchaseItem {
  id: string;
  purchase_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AutoPartsStaff {
  id: string;
  business_id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'cashier';
  pin_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutoPartsAlert {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'new_order' | 'payment_received' | 'unpaid_invoice';
  message: string;
  reference_id?: string;
  reference_type?: string;
  read: boolean;
  created_at: string;
}

// ─── Rapport types ───
export interface SalesSummary {
  current: {
    order_count: number;
    client_count: number;
    total_revenue: number;
    avg_order_value: number;
    daily_avg: number;
    payment_breakdown: Record<string, number>;
  };
  previous: {
    order_count: number;
    client_count: number;
    total_revenue: number;
    avg_order_value: number;
  };
  evolution: {
    revenue_pct: number | null;
    orders_pct: number | null;
    clients_pct: number | null;
    avg_value_pct: number | null;
  };
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  prev_quantity: number;
  prev_revenue: number;
  qty_evolution: number | null;
  revenue_evolution: number | null;
}

export interface DormantProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  cost_price: number;
  stock_value: number;
  unit_price: number;
  potential_revenue?: number;
  potential_profit?: number;
  category_name: string | null;
  last_sale_date: string | null;
  days_since_sale: number;
}

export interface StockForecast {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  min_stock: number;
  unit_price: number;
  avg_daily_sales: number;
  days_until_rupture: number | null;
  risk_level: 'rupture' | 'high' | 'medium' | 'low' | 'safe' | 'unknown';
}

export interface BrandAnalysis {
  brand_id: string;
  brand_name: string | null;
  sale_count: number;
  revenue: number;
  percentage: number;
}

export interface ProfitSummary {
  summary: {
    item_count: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    margin_pct: number;
  };
  top_products: ProfitItem[];
  top_categories: ProfitItem[];
  top_suppliers: ProfitItem[];
}

export interface ProfitItem {
  product_name?: string;
  category_name?: string;
  supplier_name?: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

export interface EmployeePerformance {
  staff_id: string;
  staff_name: string;
  staff_role: string;
  sale_count: number;
  total_revenue: number;
  avg_ticket: number;
  client_count: number;
}

export interface HourlyActivity {
  hour: number;
  day_of_week: number;
  sale_count: number;
  revenue: number;
}

export interface StoreHealth {
  score: number;
  sales_growth: number;
  stock_turnover: number;
  dormant_ratio: number;
  rupture_ratio: number;
  margin_pct: number;
  category_count: number;
  total_products: number;
  active_products: number;
  out_of_stock: number;
  dormant_count: number;
  level: 'excellent' | 'bon' | 'moyen' | 'surveiller' | 'critique';
  recommendations: string[];
}

export interface WeeklyTrend {
  week_start: string;
  total_sales: number;
  order_count: number;
}

export interface ClientSummary {
  total_clients: number;
  total_invoices: number;
  invoices_month: number;
  invoices_today: number;
}

export interface KPIData {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: number | null;
  trendLabel?: string;
}
