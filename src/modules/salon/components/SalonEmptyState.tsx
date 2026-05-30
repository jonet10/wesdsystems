import type { ReactNode } from "react";

interface SalonEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SalonEmptyState({ icon, title, description, action }: SalonEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/70 p-8 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

