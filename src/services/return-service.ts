import { supabase } from "@/lib/supabase";

export type BusinessModule = "salon" | "bar" | "auto-parts" | "boutique" | "market" | "pharmacy";

export interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface ReturnResult {
  success: boolean;
  error?: string;
  sale_id: string;
  refund_status: "none" | "partial" | "full";
  return_amount?: number;
}

export interface ReturnRecord {
  id: string;
  created_at: string;
  movement_type: string;
  quantity: number;
  quantity_delta?: number;
  product?: { id: string; name: string } | null;
  sale?: {
    id: string;
    sale_number?: string;
    invoice_number?: string;
    total_amount?: number;
    total?: number;
    refund_status: string;
    refunded_at: string | null;
    customer_name?: string;
    client_name?: string;
  } | null;
  notes?: string;
  reason?: string;
}

type SaleWithItems = Record<string, unknown> & {
  id: string;
  items?: Record<string, unknown>[];
};

export async function listSales(module: BusinessModule, businessId: string | null): Promise<SaleWithItems[]> {
  if (!businessId) return [];

  switch (module) {
    case "auto-parts": {
      const { data, error } = await supabase.rpc("auto_parts_list_sales", { p_business_id: businessId });
      if (error) throw error;
      return (data as SaleWithItems[]) ?? [];
    }
    case "salon": {
      const { data, error } = await supabase
        .from("salon_sales")
        .select("*, items:salon_sale_items(*)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as SaleWithItems[]) ?? [];
    }
    default:
      return [];
  }
}

export async function processReturn(
  module: BusinessModule,
  params: {
    business_id: string;
    branch_id?: string;
    sale_id: string;
    items: ReturnItem[];
    reason?: string;
    cashier_id?: string | null;
  }
): Promise<ReturnResult> {
  const { business_id, branch_id, sale_id, items, reason, cashier_id } = params;

  switch (module) {
    case "auto-parts": {
      const { data, error } = await supabase.rpc("process_auto_parts_return", {
        p_business_id: business_id,
        p_sale_id: sale_id,
        p_items: JSON.parse(JSON.stringify(items)),
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data as ReturnResult;
    }

    case "salon": {
      if (!branch_id) throw new Error("branch_id is required for salon returns");
      const { data, error } = await supabase.rpc("process_salon_return", {
        p_business_id: business_id,
        p_branch_id: branch_id,
        p_sale_id: sale_id,
        p_items: JSON.parse(JSON.stringify(items)),
        p_reason: reason ?? null,
        p_cashier_id: cashier_id ?? null,
      });
      if (error) throw error;
      return data as ReturnResult;
    }

    default:
      throw new Error(`Return processing not yet implemented for module: ${module}`);
  }
}

export async function listReturns(
  module: BusinessModule,
  businessId: string | null,
  branchId?: string | null
): Promise<ReturnRecord[]> {
  if (!businessId) return [];

  switch (module) {
    case "auto-parts": {
      const { data, error } = await supabase.rpc("auto_parts_list_returns", { p_business_id: businessId });
      if (error) throw error;
      return (data as ReturnRecord[]) ?? [];
    }
    case "salon": {
      const { data, error } = await supabase.rpc("salon_list_returns", {
        p_business_id: businessId,
        p_branch_id: branchId ?? null,
      });
      if (error) throw error;
      return (data as ReturnRecord[]) ?? [];
    }
    default:
      return [];
  }
}
