import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarRange, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessSubscription } from "@/hooks/useBusinessSubscription";
import { supabase } from "@/lib/supabase";
import { buildMonCashSubscriptionPaymentLink } from "@/lib/moncash";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

type BusinessMeta = {
  id: string;
  name: string | null;
  currency_code: string | null;
};

export function SubscriptionPaymentCard({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const { data } = useBusinessSubscription();
  const { formatCompact } = useCurrency();
  const [durationMonths, setDurationMonths] = useState("1");

  const businessId = profile?.business_id ?? null;
  const isBusinessOwner = profile?.role === "salon_admin" || profile?.role === "bar_admin";

  const { data: business } = useQuery({
    queryKey: ["subscription-payment-card-business", businessId],
    enabled: Boolean(businessId && isBusinessOwner),
    queryFn: async () => {
      if (!businessId) return null;
      const { data } = await supabase
        .from("businesses")
        .select("id, name, currency_code")
        .eq("id", businessId)
        .maybeSingle();
      return (data as BusinessMeta | null) ?? null;
    },
  });

  const plan = data?.plan;
  const subscription = data?.subscription;
  const duration = Number(durationMonths || 1);
  const effectiveBillingCycle = duration === 1 ? "monthly" : duration >= 12 ? "yearly" : "custom";
  const monthlyPrice = plan ? Number(plan.monthly_price || 0) : 0;
  const baseAmount = monthlyPrice * duration;

  const paymentUrl = useMemo(() => {
    if (!businessId || !plan?.id) return null;
    return buildMonCashSubscriptionPaymentLink({
      businessId,
      subscriptionId: subscription?.id || null,
      planId: plan.id,
      billingCycle: effectiveBillingCycle,
      durationMonths: duration,
      businessName: business?.name || undefined,
      planName: plan.name,
      amount: baseAmount,
      currencyCode: business?.currency_code || "HTG",
    });
  }, [baseAmount, business?.currency_code, business?.name, businessId, duration, effectiveBillingCycle, plan?.id, plan?.name, subscription?.id]);

  if (!isBusinessOwner) return null;

  return (
    <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/10 to-cyan-500/10", compact && "mb-4")}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Paiement d'abonnement</p>
                <Badge variant="secondary" className="gap-1">
                  <CalendarRange className="h-3.5 w-3.5" />
                  1 à 12 mois
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Payez votre abonnement avec MonCash. Visa, Mastercard et PayPal pourront être ajoutés plus tard comme moyens automatiques.
              </p>
              <p className="text-xs text-muted-foreground">
                {plan ? (
                  <>
                    Plan actuel: <span className="font-medium text-foreground">{plan.name}</span>
                    {" · "}
                    {formatCompact(monthlyPrice)} / mois · total {formatCompact(baseAmount)} {business?.currency_code || "HTG"}
                  </>
                ) : (
                  "Aucun plan détecté pour cet établissement."
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Durée</label>
              <Select value={durationMonths} onValueChange={setDurationMonths}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Durée" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {month} mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" asChild>
                  <Link to="/#pricing">
                    Changer de plan
                  </Link>
                </Button>
                <Button asChild disabled={!paymentUrl || !plan}>
                  <Link to={paymentUrl || "#"}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payer avec MonCash
                  </Link>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Le montant est calculé à partir du prix mensuel multiplié par la durée sélectionnée.
              </p>
            </div>
          </div>
        </div>

        {!plan && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Le plan n'est pas encore défini. Assure-toi d'avoir sélectionné un plan au moment de l'inscription ou demande au super admin de le corriger.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
