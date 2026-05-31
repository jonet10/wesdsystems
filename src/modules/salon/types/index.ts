export type SalonDomain =
  | "pos"
  | "inventory"
  | "appointments"
  | "employees"
  | "analytics"
  | "customers";

export type PaymentMethod = "cash" | "moncash" | "natcash" | "card" | "mixed";

export interface SalonBusinessScope {
  businessId: string;
}

export interface MoneyAmount {
  amount: number;
  currencyCode: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}
