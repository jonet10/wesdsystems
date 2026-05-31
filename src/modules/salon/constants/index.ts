import type { PaymentMethod, SalonDomain } from "../types";

export const SALON_DOMAINS: SalonDomain[] = [
  "pos",
  "inventory",
  "appointments",
  "employees",
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

