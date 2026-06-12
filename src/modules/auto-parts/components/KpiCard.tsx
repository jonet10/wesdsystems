import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  color?: string;
  className?: string;
}

export function KpiCard({ icon, label, value, trend, trendLabel, color = "text-blue-500", className }: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="pb-2 flex-row items-center gap-2">
        {icon && <div className={color}>{icon}</div>}
        <CardTitle className="text-sm text-muted-foreground font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold font-display">{value}</p>
        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1 mt-1">
            {trend > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : trend < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {trend > 0 ? "+" : ""}{trend}%
            </span>
            {trendLabel && <span className="text-xs text-muted-foreground ml-1">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
