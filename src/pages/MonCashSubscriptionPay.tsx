import { useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MONCASH_PUBLIC_URLS } from "@/lib/moncash";

const toText = (value: string | null) => (value && value.trim() ? value.trim() : "");

export default function MonCashSubscriptionPayPage() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [loading, setLoading] = useState(false);

  const businessId = toText(params.get("business_id"));
  const planId = toText(params.get("plan_id"));
  const businessName = toText(params.get("business_name")) || "Votre établissement";
  const planName = toText(params.get("plan_name")) || "Abonnement";
  const billingCycle = toText(params.get("billing_cycle")) || "monthly";
  const durationMonths = Math.max(1, Math.min(12, Number(toText(params.get("duration_months")) || "1")));
  const amount = Number(params.get("amount") || 0);
  const currencyCode = toText(params.get("currency_code")) || "HTG";

  const canPay = Boolean(businessId && planId);

  const startPayment = async () => {
    if (!canPay) {
      toast.error("Lien de paiement incomplet.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/moncash/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          plan_id: planId,
          business_name: businessName,
          billing_cycle: billingCycle,
          duration_months: durationMonths,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Impossible d'initialiser le paiement MonCash.");
      }

      if (!payload?.data?.redirect_url) {
        throw new Error("MonCash n'a pas renvoyé d'URL de paiement.");
      }

      window.location.assign(payload.data.redirect_url);
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors du lancement MonCash.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_28%),linear-gradient(180deg,_#08111f_0%,_#0f172a_55%,_#020617_100%)] text-white px-4 py-10 flex items-center justify-center">
      <Card className="w-full max-w-2xl border-white/10 bg-white/6 backdrop-blur-xl shadow-2xl text-white">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-400/30 text-blue-300">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.22em] text-blue-200/80">Paiement abonnement</p>
              <h1 className="text-2xl sm:text-3xl font-semibold mt-1">Régler via MonCash</h1>
              <p className="mt-2 text-sm text-white/70">
                Vérifiez les détails ci-dessous, puis lancez le paiement sécurisé MonCash.
              </p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Sécurisé
            </Badge>
          </div>

          {!canPay ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Lien incomplet</p>
                <p className="mt-1 text-amber-100/80">
                  Il manque au moins `business_id` ou `plan_id` dans l'URL.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Entreprise</p>
                <p className="mt-1 text-base font-medium">{businessName}</p>
                <p className="mt-1 text-xs text-white/60 break-all">{businessId}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Plan</p>
                <p className="mt-1 text-base font-medium">{planName}</p>
                <p className="mt-1 text-xs text-white/60 capitalize">
                  {durationMonths} mois · {billingCycle}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Montant</p>
                <p className="mt-1 text-2xl font-semibold">
                  {amount > 0 ? `${amount.toLocaleString("fr-FR")} ${currencyCode}` : "Calculé au lancement"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">URL MonCash</p>
                <p className="mt-1 text-sm text-white/70 break-all">{MONCASH_PUBLIC_URLS.websiteUrl}</p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-50">
            Après paiement, MonCash ramènera le client vers la page de confirmation et Wesd Systems activera l'abonnement automatiquement.
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={startPayment}
              disabled={!canPay || loading}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {loading ? "Initialisation..." : "Payer avec MonCash"}
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Link to="/">
                Retour à l'accueil
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
