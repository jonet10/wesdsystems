import type { CartItem, CatalogItem, SaleItemType } from "./types";
import { applyPromotions } from "./promotion-engine";

export function createCartItem(item: CatalogItem, type: SaleItemType, customOptions?: { optionsText?: string, extraCost?: number }): CartItem {
  const optionsSuffix = customOptions?.optionsText ? ` (${customOptions.optionsText})` : "";
  const keyOptions = customOptions?.optionsText ? `-${customOptions.optionsText}` : "";
  const basePrice = Number(item.unit_price || 0);
  
  return {
    key: `${type}-${item.id}${keyOptions}`,
    type,
    item_id: item.id,
    name: `${item.name}${optionsSuffix}`,
    quantity: 1,
    unit_price: basePrice + (customOptions?.extraCost || 0),
    category: item.category,
    promotion_applied: false,
    discount: 0,
  };
}

export function addItemToCart(cart: CartItem[], item: CatalogItem, type: SaleItemType, promotions = [], customOptions?: { optionsText?: string, extraCost?: number }) {
  const keyOptions = customOptions?.optionsText ? `-${customOptions.optionsText}` : "";
  const key = `${type}-${item.id}${keyOptions}`;
  const existingIndex = cart.findIndex((cartItem) => cartItem.key === key);
  const next = [...cart];

  if (existingIndex >= 0) {
    next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + 1 };
  } else {
    next.push(createCartItem(item, type, customOptions));
  }

  return applyPromotions(next, promotions);
}

export function updateCartQuantity(cart: CartItem[], key: string, delta: number, promotions = []) {
  const next = cart
    .map((item) => {
      if (item.key !== key) return item;
      const quantity = Math.max(0, item.quantity + delta);
      return quantity === 0 ? null : { ...item, quantity };
    })
    .filter(Boolean) as CartItem[];

  return applyPromotions(next, promotions);
}

export function removeCartItem(cart: CartItem[], key: string, promotions = []) {
  return applyPromotions(cart.filter((item) => item.key !== key), promotions);
}
