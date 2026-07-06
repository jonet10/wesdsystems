import type { CartItem, Promotion } from "./types";

const itemMatchesPromotion = (item: CartItem, promotion: Promotion) => {
  if (item.type === "product") return promotion.items_config?.products?.includes(item.item_id);
  if (item.type === "service") return promotion.items_config?.services?.includes(item.item_id);
  return false;
};

export function applyPromotions(cartItems: CartItem[], promotions: Promotion[]): CartItem[] {
  return cartItems.map((item) => {

    const applicablePromo = promotions.find((promotion) => {
      if (promotion.promotion_type === "percentage" || promotion.promotion_type === "fixed_amount") {
        return itemMatchesPromotion(item, promotion);
      }

      if (promotion.promotion_type === "bundle") {
        return itemMatchesPromotion(item, promotion) && !!promotion.minimum_quantity && item.quantity >= promotion.minimum_quantity;
      }

      if (promotion.promotion_type === "combo") {
        const configuredIds = [
          ...(promotion.items_config?.products ?? []),
          ...(promotion.items_config?.services ?? []),
        ];
        return configuredIds.length > 0 && configuredIds.every((id) => cartItems.some((cartItem) => cartItem.item_id === id));
      }

      return false;
    });

    if (!applicablePromo) return { ...item, promotion_applied: false, promotion_name: undefined, discount: 0 };

    let discount = 0;
    const lineTotal = item.unit_price * item.quantity;

    if (applicablePromo.promotion_type === "percentage" && applicablePromo.discount_percentage) {
      discount = lineTotal * (applicablePromo.discount_percentage / 100);
    } else if (applicablePromo.discount_value) {
      discount = applicablePromo.promotion_type === "combo"
        ? applicablePromo.discount_value / Math.max(1, cartItems.length)
        : applicablePromo.discount_value;
    }

    return {
      ...item,
      promotion_applied: true,
      promotion_name: applicablePromo.name,
      discount: Math.min(lineTotal, discount),
    };
  });
}
