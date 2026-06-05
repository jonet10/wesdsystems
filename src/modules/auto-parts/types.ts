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
