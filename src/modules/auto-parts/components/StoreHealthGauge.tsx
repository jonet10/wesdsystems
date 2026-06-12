import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StoreHealthGaugeProps {
  score: number;
  level: string;
  size?: "sm" | "md" | "lg";
}

const LEVEL_COLORS: Record<string, string> = {
  excellent: "text-emerald-500 border-emerald-500",
  bon: "text-green-500 border-green-500",
  moyen: "text-amber-500 border-amber-500",
  surveiller: "text-orange-500 border-orange-500",
  critique: "text-red-500 border-red-500",
};

const LEVEL_BG: Record<string, string> = {
  excellent: "bg-emerald-50 dark:bg-emerald-950",
  bon: "bg-green-50 dark:bg-green-950",
  moyen: "bg-amber-50 dark:bg-amber-950",
  surveiller: "bg-orange-50 dark:bg-orange-950",
  critique: "bg-red-50 dark:bg-red-950",
};

const LEVEL_LABELS: Record<string, string> = {
  excellent: "Excellent",
  bon: "Bon",
  moyen: "Moyen",
  surveiller: "À surveiller",
  critique: "Critique",
};

export function StoreHealthGauge({ score, level, size = "md" }: StoreHealthGaugeProps) {
  const circumference = size === "sm" ? 120 : size === "lg" ? 240 : 180;
  const radius = circumference / (2 * Math.PI);
  const strokeWidth = size === "sm" ? 8 : size === "lg" ? 14 : 10;
  const viewBox = `0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`;
  const center = radius + strokeWidth;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2 p-4 rounded-xl", LEVEL_BG[level])}>
      <svg viewBox={viewBox} className={cn(size === "sm" ? "w-24 h-24" : size === "lg" ? "w-48 h-48" : "w-36 h-36")}>
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-1000", LEVEL_COLORS[level])}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text x={center} y={center - 6} textAnchor="middle" className="text-3xl font-bold fill-current" dy="0">
          {score}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" className="text-xs fill-muted-foreground">
          / 100
        </text>
      </svg>
      <span className={cn("font-semibold text-sm", LEVEL_COLORS[level])}>
        {LEVEL_LABELS[level] ?? level}
      </span>
    </div>
  );
}

export function HealthDetails({ health }: { health: { score: number; sales_growth: number; stock_turnover: number; dormant_ratio: number; rupture_ratio: number; margin_pct: number; category_count: number; total_products: number; active_products: number; out_of_stock: number; dormant_count: number; level: string; recommendations: string[] } }) {
  const metrics = [
    { label: "Croissance ventes", value: `${health.sales_growth > 0 ? "+" : ""}${health.sales_growth}%`, score: health.sales_growth > 10 ? "good" : health.sales_growth > 0 ? "ok" : "bad" },
    { label: "Rotation stock", value: `${health.stock_turnover}x/mois`, score: health.stock_turnover > 1 ? "good" : health.stock_turnover > 0.5 ? "ok" : "bad" },
    { label: "Produits dormants", value: `${health.dormant_count} (${health.dormant_ratio}%)`, score: health.dormant_ratio < 10 ? "good" : health.dormant_ratio < 25 ? "ok" : "bad" },
    { label: "Ruptures", value: `${health.out_of_stock} (${health.rupture_ratio}%)`, score: health.rupture_ratio < 2 ? "good" : health.rupture_ratio < 5 ? "ok" : "bad" },
    { label: "Marge moyenne", value: `${health.margin_pct}%`, score: health.margin_pct > 30 ? "good" : health.margin_pct > 15 ? "ok" : "bad" },
    { label: "Catégories", value: `${health.category_count}`, score: health.category_count >= 5 ? "good" : health.category_count >= 3 ? "ok" : "bad" },
  ];

  return (
    <div className="space-y-4">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-center justify-between">
          <span className="text-sm">{m.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{m.value}</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              m.score === "good" ? "bg-emerald-500" : m.score === "ok" ? "bg-amber-500" : "bg-red-500"
            )} />
          </div>
        </div>
      ))}
    </div>
  );
}
