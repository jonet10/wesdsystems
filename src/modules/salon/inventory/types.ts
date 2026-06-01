export type StockMovementType = "purchase" | "sale" | "adjustment" | "loss" | "audit";

export interface StockMovementInput {
  business_id: string;
  branch_id: string;
  product_id?: string | null;
  beverage_id?: string | null;
  movement_type: StockMovementType;
  quantity_delta: number;
  quantity_before?: number | null;
  quantity_after?: number | null;
  unit_cost?: number | null;
  reason?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_by?: string | null;
}

export interface LowStockAlert {
  id: string;
  message: string;
  alert_type: string;
  created_at: string;
}
