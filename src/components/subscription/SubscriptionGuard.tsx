import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusinessSubscription } from "@/hooks/useBusinessSubscription";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SubscriptionGuard({ children, fallback }: SubscriptionGuardProps) {
  const { profile } = useAuth();
  const { data, isLoading, isFetching } = useBusinessSubscription();
  const isOwner = profile?.role === "salon_admin" || profile?.role === "bar_admin";

  console.log(`[SubscriptionGuard] isLoading=${isLoading} isFetching=${isFetching} isActive=${data?.isActive} hasSubscription=${!!data?.subscription} status=${data?.subscription?.status} end_date=${data?.subscription?.end_date} hasPlan=${!!data?.plan}`);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data?.isActive) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20">
        <Crown className="h-7 w-7 text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-semibold">Abonnement requis</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {isOwner
            ? data?.subscription && data.subscription.end_date && new Date(data.subscription.end_date + "T23:59:59") < new Date()
              ? "Votre abonnement a expiré. Souscrivez à un forfait pour réactiver l'accès."
              : !data?.subscription
                ? "Aucun abonnement actif. Souscrivez à un forfait pour accéder à cette fonctionnalité."
                : "Votre abonnement est inactif. Souscrivez à un forfait pour accéder à cette fonctionnalité."
            : "Cette fonctionnalité nécessite un abonnement actif. Contactez l'administrateur de votre établissement."}
        </p>
      </div>
      {isOwner && (
        <Button asChild>
          <a href="/salon/settings?tab=subscription">Voir les forfaits</a>
        </Button>
      )}
    </div>
  );
}
