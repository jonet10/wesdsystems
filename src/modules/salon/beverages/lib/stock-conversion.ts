import { DEFAULT_BEVERAGE_UNITS_PER_CASE } from "../../constants";
import type { BeverageStock, BeverageStockSnapshot } from "../types";

export function calculateTotalUnits(stock: BeverageStock): number {
  const unitsPerCase = stock.units_per_case || DEFAULT_BEVERAGE_UNITS_PER_CASE;
  return stock.stock_cases * unitsPerCase + stock.stock_units;
}

export function addBeverageStock(current: BeverageStock, addedCases = 0, addedUnits = 0): BeverageStockSnapshot {
  const next = {
    units_per_case: current.units_per_case || DEFAULT_BEVERAGE_UNITS_PER_CASE,
    stock_cases: current.stock_cases + addedCases,
    stock_units: current.stock_units + addedUnits,
  };

  return {
    ...next,
    total_units_available: calculateTotalUnits(next),
  };
}

export function deductBeverageUnits(current: BeverageStock, unitsSold: number): BeverageStockSnapshot {
  const unitsPerCase = current.units_per_case || DEFAULT_BEVERAGE_UNITS_PER_CASE;
  const totalUnits = calculateTotalUnits(current);

  if (unitsSold > totalUnits) {
    throw new Error("Stock boisson insuffisant");
  }

  const remainingUnits = totalUnits - unitsSold;
  const stockCases = Math.floor(remainingUnits / unitsPerCase);
  const stockUnits = remainingUnits % unitsPerCase;

  return {
    units_per_case: unitsPerCase,
    stock_cases: stockCases,
    stock_units: stockUnits,
    total_units_available: remainingUnits,
  };
}

