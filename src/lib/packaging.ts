export const PACKAGING_TYPES = [
  "case",
  "carton",
  "sac",
  "douzaine",
  "paquet",
  "lot",
  "custom",
] as const;

export type PackagingType = (typeof PACKAGING_TYPES)[number];

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
