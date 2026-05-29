import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, XCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ActivityItem {
  id: string;
  type: "sale" | "appointment" | "expense" | "inventory" | "customer";
  title: string;
  description: string;
  time: string;
  amount?: string;
  status?: "success" | "warning" | "danger" | "info";
}

interface RecentActivityProps {
  items: ActivityItem[];
  title?: string;
  viewAllLink?: string;
  className?: string;
}

const statusConfig = {
  success: { icon: CheckCircle2, className: "text-success bg-success/10" },
  warning: { icon: AlertCircle, className: "text-warning bg-warning/10" },
  danger: { icon: XCircle, className: "text-destructive bg-destructive/10" },
  info: { icon: Clock, className: "text-info bg-info/10" },
};

const typeIcons: Record<string, string> = {
  sale: "bg-primary/10 text-primary",
  appointment: "bg-info/10 text-info",
  expense: "bg-destructive/10 text-destructive",
  inventory: "bg-warning/10 text-warning",
  customer: "bg-success/10 text-success",
};

export function RecentActivity({ items, title = "Activité récente", viewAllLink, className }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-6", className)}>
        <h3 className="font-semibold text-sm mb-4">{title}</h3>
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucune activité récente
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl border border-border", className)}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
        {viewAllLink && (
          <Link to={viewAllLink}>
            <Button variant="ghost" size="sm" className="text-xs gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              typeIcons[item.type] || "bg-muted text-muted-foreground"
            )}>
              <div className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              {item.amount && (
                <p className="text-sm font-semibold">{item.amount}</p>
              )}
              <p className="text-[10px] text-muted-foreground">{item.time}</p>
            </div>
            {item.status && (
              <div className={cn(
                "p-1 rounded-full",
                statusConfig[item.status]?.className
              )}>
                {statusConfig[item.status]?.icon && (
                  <div className="h-3 w-3" />
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
