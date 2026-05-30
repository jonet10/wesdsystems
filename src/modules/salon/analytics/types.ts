export interface SalonMetricSummary {
  dailyRevenue: number;
  monthlyRevenue: number;
  serviceProfitability: number;
  beverageProfitability: number;
  inventoryLoss: number;
  bestSellingProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
}

