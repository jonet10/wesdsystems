import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { StaggerContainer, StaggerItem } from "@/components/animations/AnimatedContainers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Building2, Users, GitBranch, CalendarDays, TrendingUp, Sparkles, Zap, RotateCcw, Play } from "lucide-react";
import { useBusinessSubscription } from "@/hooks/useBusinessSubscription";
import { useSubscriptionPaymentReminder, computeDaysRemaining } from "@/hooks/useSubscriptionPaymentReminder";
import type { SubscriptionPlan } from "@/lib/saas";
import type { SubscriptionPayment } from "@/lib/payment-providers";
import { formatLimit } from "@/lib/saas";
import { formatPaymentStatus } from "@/lib/payment-providers";
import { PaymentMethodSelectionModal } from "@/components/manual-payment/PaymentMethodSelectionModal";

interface PlanWithPrice extends SubscriptionPlan {
  price: number;
}

function getPlanStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-success/20 text-success";
    case "trialing": return "bg-warning/20 text-warning";
    case "past_due": return "bg-destructive/20 text-destructive";
    case "expired": return "bg-muted text-muted-foreground";
    case "cancelled": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

function getPlanStatusLabel(status: string): string {
  switch (status) {
    case "active": return "Actif";
    case "trialing": return "Essai";
    case "past_due": return "Paiement en retard";
    case "expired": return "Expiré";
    case "cancelled": return "Annulé";
    default: return status;
  }
}

function getPaymentStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
    case "approved": return "default";
    case "pending":
    case "pending_verification": return "secondary";
    case "rejected":
    case "failed": return "destructive";
    default: return "outline";
  }
}

export function SubscriptionDashboard() {
  const { profile } = useAuth();
  const businessId = profile?.business_id ?? null;
  const { data: subscriptionState, refetch } = useBusinessSubscription();

  const [availablePlans, setAvailablePlans] = useState<PlanWithPrice[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanWithPrice | null>(null);

  const plan = subscriptionState?.plan ?? null;
  const subscription = subscriptionState?.subscription ?? null;

  const isExpired = subscription?.status === "expired";
  const isActive = subscription?.status === "active";

  const daysRemaining = subscription?.end_date ? computeDaysRemaining(subscription.end_date) : null;

  useEffect(() => {
    if (!businessId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [{ data: planRows }, { data: paymentRows }] = await Promise.all([
          supabase.from("subscription_plans").select("*").eq("active", true).order("monthly_price", { ascending: true }),
          supabase
            .from("subscription_payments")
            .select("*")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        setAvailablePlans(
          ((planRows || []) as SubscriptionPlan[]).map((p) => ({
            ...p,
            price: Number(p.monthly_price || 0),
          }))
        );

        setPayments((paymentRows || []) as SubscriptionPayment[]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [businessId]);

  if (loading || !subscriptionState) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <StaggerContainer className="space-y-6">
      <StaggerItem>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Forfait actuel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold font-display">{plan?.name || "Aucun forfait"}</p>
              <Badge className={`mt-2 ${getPlanStatusColor(subscription?.status || "expired")}`}>
                {getPlanStatusLabel(subscription?.status || "expired")}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Expiration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold font-display">
                {subscription?.end_date
                  ? new Date(subscription.end_date).toLocaleDateString("fr-FR")
                  : "N/A"}
              </p>
              {daysRemaining !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {daysRemaining > 0 ? `${daysRemaining} jours restants` : daysRemaining === 0 ? "Expire aujourd'hui" : "Expiré"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Employés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold font-display">
                {formatLimit(subscriptionState?.maxStaff)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Maximum autorisé</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Succursales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold font-display">
                {formatLimit(subscriptionState?.maxBranches)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Maximum autorisé</p>
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-semibold font-display">Forfaits disponibles</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {availablePlans
              .filter((p) => !plan || p.price >= Number(plan.monthly_price || 0))
              .map((p) => {
              const isCurrentPlan = plan?.id === p.id;
              const isUpgrade = p.price > (plan ? Number(plan.monthly_price || 0) : 0);

              return (
                <Card key={p.id} className={`relative ${isCurrentPlan ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
                  {isCurrentPlan && (
                    <div className="absolute top-3 right-3">
                      <Badge>Actuel</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {p.name === "Starter" && <Zap className="h-4 w-4 text-muted-foreground" />}
                      {p.name === "Standard" && <Sparkles className="h-4 w-4 text-primary" />}
                      {p.name === "Premium" && <TrendingUp className="h-4 w-4 text-primary" />}
                      {p.name === "Enterprise" && <Building2 className="h-4 w-4 text-primary" />}
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold font-display">{p.price.toLocaleString()} HTG</p>
                      <p className="text-xs text-muted-foreground">/ mois</p>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Jusqu'à {formatLimit(p.max_staff)} employés</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>Jusqu'à {formatLimit(p.max_branches)} succursale{p.max_branches !== 1 ? "s" : ""}</span>
                      </li>
                      {p.description && (
                        <li className="text-muted-foreground text-xs pt-1 border-t border-border/50">
                          {p.description}
                        </li>
                      )}
                    </ul>
                    <Button
                      variant={isCurrentPlan ? "outline" : "hero"}
                      className="w-full"
                      onClick={() => setCheckoutPlan(p)}
                    >
                      {(() => {
                        if (!isCurrentPlan) return isUpgrade ? "Changer pour ce forfait" : "Souscrire";
                        if (isExpired) return <><Play className="mr-1 h-4 w-4" /> Payer maintenant</>;
                        return <><RotateCcw className="mr-1 h-4 w-4" /> Renouveler maintenant</>;
                      })()}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-semibold font-display">Historique des paiements</h3>
          </div>
          <Card>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucun paiement enregistré.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Plan</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Montant</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Transaction</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Méthode</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-4 text-sm">
                            {new Date(payment.created_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="p-4 text-sm font-medium">
                            {availablePlans.find((p) => p.id === payment.plan_id)?.name || payment.plan_id.slice(0, 8)}
                          </td>
                          <td className="p-4 text-sm font-medium">
                            {Number(payment.amount).toLocaleString()} {payment.currency_code}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground font-mono">
                            {payment.transaction_id || payment.transaction_reference || "—"}
                          </td>
                          <td className="p-4 text-sm capitalize">{payment.payment_method}</td>
                          <td className="p-4">
                            <Badge variant={getPaymentStatusVariant(payment.status)}>
                              {formatPaymentStatus(payment.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {checkoutPlan && businessId && (
        <PaymentMethodSelectionModal
          open={!!checkoutPlan}
          onOpenChange={(open) => { if (!open) setCheckoutPlan(null); }}
          planId={checkoutPlan.id}
          planName={checkoutPlan.name}
          monthlyPrice={Number(checkoutPlan.monthly_price || checkoutPlan.price || 0)}
          yearlyPrice={Number(checkoutPlan.yearly_price || 0)}
          businessId={businessId}
          businessName={profile?.business_name || undefined}
          onSuccess={() => { setCheckoutPlan(null); void refetch(); }}
        />
      )}
    </StaggerContainer>
  );
}
