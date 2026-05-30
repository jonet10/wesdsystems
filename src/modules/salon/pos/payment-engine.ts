import type { PaymentMethod } from "../types";
import type { PaymentSplit } from "./types";

export function buildPaymentSplits(method: PaymentMethod, total: number, splits: PaymentSplit[] = []): PaymentSplit[] {
  if (method !== "mixed") {
    return [{ method, amount: total } as PaymentSplit];
  }

  return splits.filter((split) => split.amount > 0);
}

export function validatePayment(total: number, splits: PaymentSplit[]) {
  const paid = splits.reduce((sum, split) => sum + split.amount, 0);
  return {
    paid,
    remaining: Math.max(0, total - paid),
    isPaid: Math.abs(paid - total) < 0.01,
  };
}

