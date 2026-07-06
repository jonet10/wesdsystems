export type PendingTabStatus = "open" | "closed" | "cancelled";
export type PendingTabItemType = "product" | "service";

export interface PendingTabItem {
  id: string;
  tab_id: string;
  item_type: PendingTabItemType;
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  added_at: string;
  added_by: string | null;
}

export interface PendingTabSummary {
  id: string;
  tab_number: string;
  label: string;
  client_id: string | null;
  guest_name: string | null;
  status: PendingTabStatus;
  branch_id: string;
  cashier_id: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  items_count: number;
  total_amount: number;
}

export interface PendingTabDetail extends PendingTabSummary {
  items: PendingTabItem[];
}

export interface PendingTabCreateInput {
  label: string;
  client_id?: string | null;
  guest_name?: string | null;
  branch_id: string;
  cashier_id?: string | null;
  notes?: string | null;
}

export interface PendingTabItemInput {
  item_type: PendingTabItemType;
  item_id: string;
  item_name: string;
  unit_price: number;
  quantity?: number;
  added_by?: string | null;
}

export interface PendingTabCheckoutInput {
  payment_method: string;
  amount_paid: number;
  total_amount?: number;
  discount_amount?: number;
  cashier_id?: string | null;
  cashier_name?: string | null;
  employee_id?: string | null;
  currency_code?: string;
  payment_splits?: Array<{ method: string; amount: number }>;
}
