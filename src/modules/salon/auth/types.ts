export interface EmployeeSession {
  id: string;
  full_name: string;
  role: string;
  branch_id: string;
  session_token?: string;
  session_expires_at?: string;
}

export interface EmployeeCatalogProduct {
  id: string;
  name: string;
  unit_price: number;
  category?: string | null;
  quantity_in_stock?: number | null;
  barcode?: string | null;
}

export interface EmployeeCatalogService {
  id: string;
  name: string;
  price_htg: number;
  category_id?: string | null;
  metadata?: Record<string, any> | null;
}

export interface EmployeeCatalogPromotion {
  id: string;
  name: string;
  description?: string | null;
  promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
  discount_value?: number | null;
  discount_percentage?: number | null;
  items_config?: { services?: string[]; products?: string[] } | null;
  minimum_quantity?: number | null;
}

export interface EmployeeCatalogStaff {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  commission_percentage?: number | null;
  metadata?: Record<string, any> | null;
  is_active?: boolean | null;
}

export interface EmployeePosBundle {
  employee: {
    id: string;
    full_name: string;
    role: string;
    branch_id: string;
  };
  branch: {
    id: string;
    business_id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  business: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  products: EmployeeCatalogProduct[];
  services: EmployeeCatalogService[];
  promotions: EmployeeCatalogPromotion[];
  employees: EmployeeCatalogStaff[];
}
