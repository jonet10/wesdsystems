import type { PaymentMethod, SalonDomain } from "../types";

export const SALON_DOMAINS: SalonDomain[] = [
  "pos",
  "inventory",
  "appointments",
  "employees",
  "beverages",
  "analytics",
  "customers",
];

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Espèces" },
  { id: "moncash", label: "MonCash" },
  { id: "natcash", label: "NatCash" },
  { id: "card", label: "Carte" },
  { id: "mixed", label: "Paiement mixte" },
];

export const DEFAULT_BEVERAGE_UNITS_PER_CASE = 24;

