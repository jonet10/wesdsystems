export interface StationeryCategory {
  id: string;
  business_id: string;
  branch_id?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  active: boolean;
  created_at: string;
}

export interface StationeryProduct {
  id: string;
  business_id: string;
  branch_id?: string;
  category_id?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  image_url?: string;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  selling_unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StationeryCustomer {
  id: string;
  business_id: string;
  branch_id?: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface StationerySupplier {
  id: string;
  business_id: string;
  branch_id?: string;
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface StationerySale {
  id: string;
  business_id: string;
  branch_id?: string;
  customer_id?: string;
  cashier_id?: string;
  invoice_number: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_method: string;
  amount_paid: number;
  balance: number;
  sale_date: string;
  created_at: string;
}
