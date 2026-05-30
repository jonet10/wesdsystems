export interface BeverageStock {
  units_per_case: number;
  stock_cases: number;
  stock_units: number;
}

export interface BeverageStockSnapshot extends BeverageStock {
  total_units_available: number;
}

