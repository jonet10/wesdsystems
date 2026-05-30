import type { ReactNode } from "react";

interface SalonMetricCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  helper?: string;
}

export function SalonMetricCard({ title, value, icon, helper }: SalonMetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
        </div>
        {icon && <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>}
      </div>
    </div>
  );
}

