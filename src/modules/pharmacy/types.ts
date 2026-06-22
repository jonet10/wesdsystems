export interface PharmacySetting {
  id: string;
  business_id: string;
  currency: string;
  receipt_prefix: string;
  invoice_prefix: string;
  prescription_required: boolean;
  enable_fefo: boolean;
  low_stock_threshold: number;
  expiring_soon_days: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacyCategory {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
}

export interface PharmacyProduct {
  id: string;
  business_id: string;
  category_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  description: string | null;
  form: string | null;
  laboratory: string | null;
  requires_prescription: boolean;
  min_stock_alert: number;
  total_stock_quantity: number;
  active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category?: PharmacyCategory;
}

export interface PharmacyProductUnit {
  id: string;
  business_id: string;
  product_id: string;
  name: string;
  barcode: string | null;
  conversion_factor: number;
  is_base_unit: boolean;
  cost_price: number;
  sale_price: number;
  created_at: string;
}

export interface PharmacyBatch {
  id: string;
  business_id: string;
  product_id: string;
  purchase_id: string | null;
  batch_number: string;
  manufacture_date: string | null;
  expiration_date: string;
  initial_quantity: number;
  current_quantity: number;
  cost_price: number;
  sale_price: number;
  created_at: string;
  product?: PharmacyProduct;
}

export interface PharmacySupplier {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact_person: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface PharmacyPurchase {
  id: string;
  business_id: string;
  supplier_id: string | null;
  purchase_number: string;
  total_amount: number;
  paid_amount: number;
  status: 'pending' | 'received' | 'cancelled';
  payment_status: 'paid' | 'partial' | 'unpaid';
  purchase_date: string;
  created_by: string | null;
  created_at: string;
  supplier?: PharmacySupplier;
}

export interface PharmacyPurchaseItem {
  id: string;
  business_id: string;
  purchase_id: string;
  product_id: string | null;
  batch_id: string | null;
  unit_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: PharmacyProduct;
  unit?: PharmacyProductUnit;
}

export interface PharmacyCustomer {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: 'M' | 'F' | 'Other' | null;
  medical_notes: string | null;
  created_at: string;
}

export interface PharmacyPrescription {
  id: string;
  business_id: string;
  customer_id: string | null;
  doctor_name: string | null;
  prescription_date: string | null;
  notes: string | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
  customer?: PharmacyCustomer;
}

export interface PharmacySale {
  id: string;
  business_id: string;
  register_id: string | null;
  customer_id: string | null;
  prescription_id: string | null;
  receipt_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'moncash' | 'natcash' | 'transfer' | 'credit';
  payment_status: 'paid' | 'credit' | 'partial';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  customer?: PharmacyCustomer;
}

export interface PharmacySaleItem {
  id: string;
  business_id: string;
  sale_id: string;
  product_id: string | null;
  unit_id: string | null;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: PharmacyProduct;
  unit?: PharmacyProductUnit;
  batch?: PharmacyBatch;
}
