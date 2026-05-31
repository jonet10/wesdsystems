import type { PaymentMethod } from "../types";

export type SaleItemType = "product" | "service";

export interface CatalogItem {
  id: string;
  name: string;
  unit_price: number;
  category?: string;
  type: SaleItemType;
  stock?: number;
  barcode?: string;
}

export interface CartItem {
  key: string;
  type: SaleItemType;
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  category?: string;
  promotion_applied?: boolean;
  promotion_name?: string;
  discount?: number;
}

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  promotion_type: "percentage" | "fixed_amount" | "bundle" | "combo";
  discount_value?: number;
  discount_percentage?: number;
  items_config: { services?: string[]; products?: string[] };
  minimum_quantity?: number;
}

export interface PaymentSplit {
  method: Exclude<PaymentMethod, "mixed">;
  amount: number;
}

export interface CartTotals {
  subtotal: number;
  promoDiscount: number;
  manualDiscount: number;
  totalDiscount: number;
  total: number;
}
