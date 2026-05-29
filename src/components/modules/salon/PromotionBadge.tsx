import { cn } from "@/lib/utils";
import { Tag, Percent, Gift, Combine } from "lucide-react";

interface PromotionBadgeProps {
  type: "percentage" | "fixed_amount" | "bundle" | "combo";
  value?: number;
  className?: string;
}

const config = {
  percentage: { icon: Percent, label: "Pourcentage", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  fixed_amount: { icon: Tag, label: "Montant fixe", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  bundle: { icon: Gift, label: "Bundle", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  combo: { icon: Combine, label: "Combo", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export function PromotionBadge({ type, value, className }: PromotionBadgeProps) {
  const cfg = config[type];
  const Icon = cfg.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      cfg.className,
      className
    )}>
      <Icon className="h-3 w-3" />
      {cfg.label}
      {value !== undefined && (
        <span className="font-bold">
          {type === "percentage" ? `-${value}%` : null}
          {type === "fixed_amount" ? `-${value} Gdes` : null}
        </span>
      )}
    </span>
  );
}
