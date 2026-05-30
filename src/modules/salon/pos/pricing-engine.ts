import type { CartItem, CartTotals } from "./types";

export function calculateCartTotals(cart: CartItem[], manualDiscountPercent = 0): CartTotals {
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const promoDiscount = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const manualDiscount = subtotal * (manualDiscountPercent / 100);
  const totalDiscount = promoDiscount + manualDiscount;

  return {
    subtotal,
    promoDiscount,
    manualDiscount,
    totalDiscount,
    total: Math.max(0, subtotal - totalDiscount),
  };
}

