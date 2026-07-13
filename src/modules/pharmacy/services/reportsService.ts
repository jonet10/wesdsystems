import { supabase } from "@/lib/supabase";

export const reportsService = {
  async getDashboardStats(businessId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch products count, low stock, out of stock
    const { data: products, error: pError } = await supabase
      .from("pharmacy_products")
      .select("id, total_stock_quantity, min_stock_alert")
      .eq("business_id", businessId)
      .eq("active", true);

    if (pError) throw pError;

    const totalProducts = products.length;
    const outOfStock = products.filter(p => Number(p.total_stock_quantity) <= 0).length;
    const lowStock = products.filter(p => Number(p.total_stock_quantity) > 0 && Number(p.total_stock_quantity) <= Number(p.min_stock_alert)).length;

    // Fetch sales for today and this month
    const { data: sales, error: sError } = await supabase
      .from("pharmacy_sales")
      .select("total, created_at")
      .eq("business_id", businessId)
      .gte("created_at", startOfMonth.toISOString());

    if (sError) throw sError;

    let salesToday = 0;
    let salesMonth = 0;
    let invoicesToday = 0;
    let invoicesMonth = sales.length;

    sales.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      salesMonth += Number(sale.total);
      if (saleDate >= today) {
        salesToday += Number(sale.total);
        invoicesToday++;
      }
    });

    // Fetch stock valuation from batches
    const { data: batches, error: bError } = await supabase
      .from("pharmacy_batches")
      .select("current_quantity, cost_price, sale_price")
      .eq("business_id", businessId)
      .gt("current_quantity", 0);

    if (bError) throw bError;

    let totalStockValue = 0;
    let totalPotentialRevenue = 0;

    batches.forEach(b => {
      const qty = Number(b.current_quantity);
      totalStockValue += qty * Number(b.cost_price || 0);
      totalPotentialRevenue += qty * Number(b.sale_price || 0);
    });

    const potentialMargin = totalPotentialRevenue - totalStockValue;

    return {
      totalProducts,
      outOfStock,
      lowStock,
      salesToday,
      salesMonth,
      invoicesToday,
      invoicesMonth,
      totalStockValue,
      totalPotentialRevenue,
      potentialMargin
    };
  },

  async getSalesEvolution(businessId: string, days: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - days);

    const { data: sales, error } = await supabase
      .from("pharmacy_sales")
      .select("total, created_at")
      .eq("business_id", businessId)
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Group sales by date
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
      dailyMap.set(label, 0);
    }

    sales.forEach(sale => {
      const label = new Date(sale.created_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
      if (dailyMap.has(label)) {
        dailyMap.set(label, dailyMap.get(label)! + Number(sale.total));
      }
    });

    return Array.from(dailyMap.entries()).map(([label, total]) => ({ label, total })).reverse();
  },

  async getTopProducts(businessId: string, limit: number = 5) {
    const { data, error } = await supabase
      .from("pharmacy_sale_items")
      .select("quantity, product:product_id(name)")
      .eq("business_id", businessId);

    if (error) throw error;

    // Aggregate by product name
    const counts = new Map<string, number>();
    data.forEach(item => {
      const name = item.product?.name || "Produit inconnu";
      counts.set(name, (counts.get(name) || 0) + Number(item.quantity));
    });

    return Array.from(counts.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  },

  async getOutOfStockItems(businessId: string, limit: number = 5) {
    const { data, error } = await supabase
      .from("pharmacy_products")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("active", true)
      .lte("total_stock_quantity", 0)
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async getCategoryDistribution(businessId: string) {
    const { data, error } = await supabase
      .from("pharmacy_products")
      .select("id, category:category_id(name)")
      .eq("business_id", businessId)
      .eq("active", true);

    if (error) throw error;

    const counts = new Map<string, number>();
    data.forEach(p => {
      const catName = p.category?.name || "Non catégorisé";
      counts.set(catName, (counts.get(catName) || 0) + 1);
    });

    const total = data.length || 1;
    const colors = ["#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"];

    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      percentage: Math.round((value / total) * 100),
      fill: colors[i % colors.length]
    }));
  },

  async getRecentActivity(businessId: string, limit: number = 5) {
    const { data, error } = await supabase
      .from("pharmacy_sales")
      .select("receipt_number, total, created_at, created_by(full_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(sale => {
      const time = new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const name = (sale.created_by as any)?.full_name || "Caissier";
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase();

      return {
        time,
        invoice: sale.receipt_number,
        initials,
        amount: Number(sale.total)
      };
    });
  }
};
