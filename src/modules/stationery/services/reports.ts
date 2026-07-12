import { supabase } from "@/lib/supabase";
import { getStoredBranchId } from "@/lib/branch";

export async function stationeryDashboardStats(businessId: string, branchId?: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  try {
    // Basic parallel queries to get dashboard stats
    // Note: In production, this should be handled by a Supabase RPC to reduce bandwidth.
    const [
      { count: productsCount },
      { data: lowStockData },
      { data: outOfStockData },
      { data: salesTodayData },
      { data: salesMonthData }
    ] = await Promise.all([
      supabase.from("stationery_products").select("*", { count: "exact", head: true }).eq("business_id", businessId),
      supabase.from("stationery_products").select("id").eq("business_id", businessId).gt("stock_quantity", 0).lte("stock_quantity", 5), // Assuming 5 is a generic low stock
      supabase.from("stationery_products").select("id").eq("business_id", businessId).lte("stock_quantity", 0),
      supabase.from("stationery_sales").select("total_amount").eq("business_id", businessId).gte("created_at", today.toISOString()),
      supabase.from("stationery_sales").select("total_amount, id").eq("business_id", businessId).gte("created_at", startOfMonth.toISOString()),
    ]);

    const salesToday = salesTodayData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
    const salesMonth = salesMonthData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
    const invoicesToday = salesTodayData?.length || 0;
    const invoicesMonth = salesMonthData?.length || 0;

    return {
      totalProducts: productsCount || 0,
      lowStock: lowStockData?.length || 0,
      outOfStock: outOfStockData?.length || 0,
      salesToday,
      salesMonth,
      invoicesToday,
      invoicesMonth,
      totalStockValue: 0, // Mocked for now, requires summing (stock * purchase_price)
      totalPotentialRevenue: 0 // Mocked for now, requires summing (stock * selling_price)
    };
  } catch (error) {
    console.error("Error fetching stationery dashboard stats", error);
    return null;
  }
}
