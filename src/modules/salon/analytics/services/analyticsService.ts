import { supabase } from "@/lib/supabase";

export async function getRevenueByPeriod(businessId: string, startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from("salon_sales")
    .select("total_amount, created_at")
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
}

export async function getEmployeePerformance(businessId: string, startIso: string, endIso: string) {
  const { data, error } = await supabase
    .from("commission_transactions")
    .select("employee_id, sale_amount, commission_amount")
    .eq("business_id", businessId)
    .gte("calculated_at", startIso)
    .lt("calculated_at", endIso)
    .neq("status", "cancelled");

  if (error) throw new Error(error.message);
  return data ?? [];
}

