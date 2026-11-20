export type SaleType = "UNITE" | "CAISSE" | "COCKTAIL" | "PLAT" | "CHAMBRE";

export type PaymentMethod = "ESPECES" | "CARTE" | "TRANSFERT" | "CREDIT" | "MONCASH";

export interface BarCategory {
  id: string;
  name: string;
  default_units_per_case: number;
  icon?: string;
  created_at?: string;
}

export interface BarProduct {
  id: string;
  branch_id: string;
  category_id?: string | null;
  supplier_id?: string | null;
  name: string;
  brand?: string | null;
  sku?: string | null;
  barcode?: string | null;
  stock_cases: number;
  stock_units: number;
  units_per_case: number;
  volume_ml?: number;
  price_per_case: number;
  price_per_unit: number;
  cost_per_case: number;
  cost_per_unit: number;
  min_stock_level: number;
  critical_stock_level: number;
  is_active: boolean;
  category?: string;
  item_type?: "drink" | "food" | "room" | "other";
  created_at?: string;
}

export interface BarCocktail {
  id: string;
  branch_id: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
  created_at?: string;
}

export interface BarCocktailIngredient {
  id?: string;
  cocktail_id: string;
  product_id: string;
  quantity_ml: number;
}

export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE";

export interface HotelRoom {
  id: string;
  branch_id: string;
  room_number: string;
  room_type: string; // Standard, Deluxe, Suite VIP, etc.
  floor: string;
  price_per_night: number;
  price_per_hour?: number; // Passage / Day Use
  status: RoomStatus;
  current_guest_name?: string | null;
  current_guest_phone?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  amenities: string[];
  notes?: string;
  is_active: boolean;
  created_at?: string;
}

export interface HotelBooking {
  id: string;
  branch_id: string;
  room_id: string;
  room_number: string;
  guest_name: string;
  guest_phone?: string;
  guest_id_number?: string;
  booking_type: "NIGHT" | "DAY_PASS";
  check_in: string;
  check_out?: string;
  total_amount: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  payment_status: "PAID" | "PENDING" | "PARTIAL";
  status: "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  notes?: string;
  created_at?: string;
}

export interface CartItem {
  key: string;
  type: "product" | "cocktail" | "food" | "room";
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  sale_type: SaleType;
  details?: string;
}

export interface BarSale {
  id: string;
  branch_id: string;
  sale_type: "BAR" | "RESTAURANT" | "HOTEL";
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  sale_number?: string;
  created_at: string;
}
