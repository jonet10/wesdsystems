export const PACKAGING_TYPES = [
  "unitaire",
  "flacon",
  "boite",
  "tube",
  "sachet",
  "spray",
  "case",
  "carton",
  "sac",
  "douzaine",
  "paquet",
  "lot",
  "custom",
] as const;

export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const PACKAGING_LABELS: Record<PackagingType, string> = {
  case: "Caisse",
  carton: "Carton",
  sac: "Sac",
  douzaine: "Douzaine",
  paquet: "Paquet",
  lot: "Lot",
  custom: "Autre",
  unitaire: "Unitaire",
  flacon: "Flacon",
  boite: "Boîte",
  tube: "Tube",
  sachet: "Sachet",
  spray: "Spray",
};

export const PACKAGING_DEFAULT_QUANTITIES: Record<PackagingType, number> = {
  case: 24,
  douzaine: 12,
  unitaire: 1,
  flacon: 1,
  boite: 1,
  tube: 1,
  sachet: 1,
  spray: 1,
  carton: 12,
  sac: 1,
  paquet: 1,
  lot: 1,
  custom: 1,
};


export interface PackagingEconomicsInput {
  packagePurchasePrice: number;
  packageQuantity: number;
  unitSellingPrice: number;
}

export interface PackagingEconomicsOutput {
  unitCost: number;
  unitProfit: number;
  packageProfit: number;
}

export function normalizePackagingQuantity(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.floor(parsed));
}

export function calculatePackagingEconomics(input: PackagingEconomicsInput): PackagingEconomicsOutput {
  const packageQuantity = normalizePackagingQuantity(input.packageQuantity);
  const packagePurchasePrice = Number.isFinite(input.packagePurchasePrice) ? input.packagePurchasePrice : 0;
  const unitSellingPrice = Number.isFinite(input.unitSellingPrice) ? input.unitSellingPrice : 0;
  const unitCost = packagePurchasePrice / packageQuantity;
  const unitProfit = unitSellingPrice - unitCost;
  const packageProfit = unitProfit * packageQuantity;

  return {
    unitCost,
    unitProfit,
    packageProfit,
  };
}
