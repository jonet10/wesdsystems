import { supabase } from "@/lib/supabase";
import type {
  SalesSummary, TopProduct, DormantProduct, StockForecast,
  BrandAnalysis, ProfitSummary, EmployeePerformance, HourlyActivity,
  StoreHealth, WeeklyTrend, ClientSummary,
} from "../types";

function callRPC<T>(name: string, args: Record<string, any>): Promise<T> {
  return supabase.rpc(name, args).then(({ data, error }) => {
    if (error) throw error;
    return data as T;
  });
}

export function salesSummary(businessId: string, startDate?: string, endDate?: string, staffId?: string | null) {
  return callRPC<SalesSummary>("auto_parts_sales_summary", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    ...(staffId ? { p_staff_id: staffId } : {}),
  });
}

export function cashierDashboard(businessId: string, staffId: string, branchId?: string | null) {
  return callRPC<{
    // Transaction counts
    salesToday: number; salesWeek: number; salesMonth: number;
    invoicesToday: number; invoicesWeek: number; invoicesMonth: number;
    // Revenue (CA)
    revenueToday: number; revenueWeek: number; revenueMonth: number;
    // Products sold
    itemsSoldToday: number; itemsSoldWeek: number; itemsSoldMonth: number;
  }>("auto_parts_cashier_dashboard", {
    p_business_id: businessId,
    p_staff_id: staffId,
    p_branch_id: branchId ?? null,
  });
}

export function adminCashierStats(businessId: string, branchId?: string | null) {
  return callRPC<{
    global: {
      // Revenue (CA)
      salesToday: number; salesWeek: number; salesMonth: number;
      invoicesToday: number; invoicesWeek: number; invoicesMonth: number;
    };
    byCashier: Array<{
      staffId: string; staffName: string;
      // Revenue per cashier
      salesToday: number; salesWeek: number; salesMonth: number;
      invoicesToday: number; invoicesWeek: number; invoicesTotal: number;
      itemsSoldMonth: number;
    }>;
  }>("auto_parts_admin_cashier_stats", {
    p_business_id: businessId,
    p_branch_id: branchId ?? null,
  });
}

export function topProducts(
  businessId: string,
  startDate?: string,
  endDate?: string,
  limit = 10,
  prevStartDate?: string,
  prevEndDate?: string,
) {
  return callRPC<TopProduct[]>("auto_parts_top_products", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_limit: limit,
    p_prev_start_date: prevStartDate ?? null,
    p_prev_end_date: prevEndDate ?? null,
  });
}

export function dormantProducts(businessId: string, days = 30) {
  return callRPC<DormantProduct[]>("auto_parts_dormant_products", {
    p_business_id: businessId,
    p_days: days,
  });
}

export function stockForecast(businessId: string, lookbackDays = 90) {
  return callRPC<StockForecast[]>("auto_parts_stock_forecast", {
    p_business_id: businessId,
    p_lookback_days: lookbackDays,
  });
}

export function brandAnalysis(businessId: string, startDate?: string, endDate?: string) {
  return callRPC<BrandAnalysis[]>("auto_parts_brand_analysis", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  });
}

export function profitSummary(businessId: string, startDate?: string, endDate?: string) {
  return callRPC<ProfitSummary>("auto_parts_profit_summary", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  });
}

export function employeePerformance(businessId: string, startDate?: string, endDate?: string) {
  return callRPC<EmployeePerformance[]>("auto_parts_employee_performance", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  });
}

export function hourlyActivity(businessId: string, startDate?: string, endDate?: string) {
  return callRPC<HourlyActivity[]>("auto_parts_hourly_activity", {
    p_business_id: businessId,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  });
}

export function storeHealth(businessId: string) {
  return callRPC<StoreHealth>("auto_parts_store_health", {
    p_business_id: businessId,
  });
}

export function weeklyTrend(businessId: string, weeks = 12) {
  return callRPC<WeeklyTrend[]>("auto_parts_weekly_trend", {
    p_business_id: businessId,
    p_weeks: weeks,
  });
}

export function clientSummary(businessId: string) {
  return callRPC<ClientSummary>("auto_parts_client_summary", {
    p_business_id: businessId,
  });
}

export function getDateRangePreset(preset: "today" | "week" | "month" | "year"): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (preset) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { start: start.toISOString(), end };
}

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export function formatDayLabel(dow: number): string {
  return DAY_LABELS[dow] ?? `J${dow}`;
}

export function formatMonthLabel(m: number): string {
  return MONTH_LABELS[m] ?? `M${m + 1}`;
}
