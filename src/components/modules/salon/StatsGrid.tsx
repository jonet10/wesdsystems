import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatItem {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  color?: string;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const colorMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 gap-4",
      columns === 3 && "lg:grid-cols-3",
      columns === 4 && "lg:grid-cols-4",
      className
    )}>
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-card rounded-xl border border-border/50 p-5 hover:shadow-soft transition-all duration-300"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
              <p className="text-2xl font-bold font-display tracking-tight">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              )}
              {stat.trend && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-1",
                  stat.trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {stat.trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{Math.abs(stat.trend.value)}% vs mois dernier</span>
                </div>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-lg",
              colorMap[stat.color || "primary"] || "bg-primary/10 text-primary"
            )}>
              {stat.icon}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
