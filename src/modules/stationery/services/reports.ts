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
      { data: productsData },
      { data: salesTodayData },
      { data: salesMonthData }
    ] = await Promise.all([
      supabase.from("stationery_products").select("stock_quantity, purchase_price, selling_price, min_stock_alert").eq("business_id", businessId),
      supabase.from("stationery_sales").select("total_amount").eq("business_id", businessId).gte("created_at", today.toISOString()),
      supabase.from("stationery_sales").select("total_amount, id").eq("business_id", businessId).gte("created_at", startOfMonth.toISOString()),
    ]);

    const salesToday = salesTodayData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
    const salesMonth = salesMonthData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
    const invoicesToday = salesTodayData?.length || 0;
    const invoicesMonth = salesMonthData?.length || 0;

    let outOfStock = 0;
    let lowStock = 0;
    let totalStockValue = 0;
    let totalPotentialRevenue = 0;

    if (productsData) {
      for (const p of productsData) {
        const qty = Number(p.stock_quantity) || 0;
        const minAlert = Number(p.min_stock_alert) || 5;
        
        if (qty <= 0) outOfStock++;
        else if (qty <= minAlert) lowStock++;

        if (qty > 0) {
          totalStockValue += qty * (Number(p.purchase_price) || 0);
          totalPotentialRevenue += qty * (Number(p.selling_price) || 0);
        }
      }
    }

    return {
      totalProducts: productsData?.length || 0,
      lowStock,
      outOfStock,
      salesToday,
      salesMonth,
      invoicesToday,
      invoicesMonth,
      totalStockValue,
      totalPotentialRevenue,
      potentialMargin: totalPotentialRevenue - totalStockValue
    };
  } catch (error) {
    return null;
  }
}

export async function getSalesEvolution(businessId: string, branchId: string | null, days: number = 7) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("stationery_sales")
    .select("total_amount, sale_date")
    .eq("business_id", businessId)
    .gte("sale_date", startDate.toISOString())
    .order("sale_date", { ascending: true });

  if (error) {
    console.error("Error fetching sales evolution", error);
    return [];
  }

  // Group by date
  const grouped = (data || []).reduce((acc: any, sale) => {
    const dateStr = new Date(sale.sale_date).toISOString().split('T')[0];
    acc[dateStr] = (acc[dateStr] || 0) + Number(sale.total_amount);
    return acc;
  }, {});

  // Fill empty days
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const shortDate = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    result.push({
      date: dateStr,
      label: shortDate.replace('.', ''),
      total: grouped[dateStr] || 0
    });
  }
  return result;
}

export async function getTopProducts(businessId: string, branchId: string | null, days: number = 30) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("stationery_sale_items")
    .select(`
      quantity,
      stationery_products ( id, name ),
      stationery_sales!inner ( business_id, sale_date )
    `)
    .eq("stationery_sales.business_id", businessId)
    .gte("stationery_sales.sale_date", startDate.toISOString());

  if (error) {
    console.error("Error fetching top products", error);
    return [];
  }

  const counts: Record<string, { name: string; quantity: number }> = {};
  (data || []).forEach((item: any) => {
    const prodId = item.stationery_products?.id;
    if (!prodId) return;
    if (!counts[prodId]) {
      counts[prodId] = { name: item.stationery_products.name, quantity: 0 };
    }
    counts[prodId].quantity += Number(item.quantity);
  });

  return Object.values(counts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

export async function getOutOfStockItems(businessId: string, branchId: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  
  const { data, error } = await supabase
    .from("stationery_products")
    .select("id, name, stock_quantity")
    .eq("business_id", businessId)
    .lte("stock_quantity", 0)
    .limit(10);

  if (error) {
    console.error("Error fetching out of stock items", error);
    return [];
  }
  return data || [];
}

export async function getCategoryDistribution(businessId: string, branchId: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  
  const { data, error } = await supabase
    .from("stationery_products")
    .select(`
      id,
      stationery_categories ( name, color )
    `)
    .eq("business_id", businessId);

  if (error) {
    console.error("Error fetching category distribution", error);
    return [];
  }

  const counts: Record<string, { name: string; value: number; fill: string }> = {};
  let total = 0;
  
  (data || []).forEach((p: any) => {
    const catName = p.stationery_categories?.name || "Sans catégorie";
    const color = p.stationery_categories?.color || "#cbd5e1";
    if (!counts[catName]) {
      counts[catName] = { name: catName, value: 0, fill: color };
    }
    counts[catName].value += 1;
    total += 1;
  });

  return Object.values(counts)
    .sort((a, b) => b.value - a.value)
    .map(c => ({
      ...c,
      percentage: total > 0 ? Math.round((c.value / total) * 100) : 0
    }));
}

export async function getRecentActivity(businessId: string, branchId: string | null) {
  const finalBranchId = branchId || getStoredBranchId(businessId);
  
  const { data, error } = await supabase
    .from("stationery_sales")
    .select(`
      id, invoice_number, total_amount, created_at, cashier_id
    `)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching recent activity", error);
    return [];
  }
  
  return (data || []).map((sale: any) => {
    // Generate initials from full name
    const name = sale.profiles?.full_name || "SJF";
    const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 3).toUpperCase();
    
    return {
      id: sale.id,
      time: new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      invoice: sale.invoice_number,
      initials,
      amount: Number(sale.total_amount)
    };
  });
}

