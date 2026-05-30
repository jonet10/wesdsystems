import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface UpgradePromptProps {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function UpgradePrompt({
  title,
  message,
  ctaLabel = "Voir les plans",
  ctaHref = "/admin/subscriptions",
}: UpgradePromptProps) {
  return (
    <Alert className="border-primary/20 bg-primary/5">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        {title}
      </AlertTitle>
      <AlertDescription className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-muted-foreground">{message}</span>
        <Button asChild size="sm" variant="outline">
          <Link to={ctaHref}>{ctaLabel}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

