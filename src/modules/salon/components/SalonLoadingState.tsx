interface SalonLoadingStateProps {
  label?: string;
}

export function SalonLoadingState({ label = "Chargement..." }: SalonLoadingStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <span>{label}</span>
    </div>
  );
}

