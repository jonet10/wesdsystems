import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Building2, Clock, Loader2, Ban } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ManualPaymentForm } from "./ManualPaymentForm";

interface PaymentMethodSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  currencyCode: string;
  businessId: string;
  businessName?: string;
}

const DURATIONS = [
  { months: 1, label: "1 mois" },
  { months: 3, label: "3 mois" },
  { months: 6, label: "6 mois" },
  { months: 12, label: "12 mois" },
] as const;

type Step = "duration" | "method" | "manual-form";

export function PaymentMethodSelectionModal({
  open,
  onOpenChange,
  planId,
  planName,
  monthlyPrice,
  yearlyPrice,
  currencyCode,
  businessId,
  businessName,
}: PaymentMethodSelectionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("duration");
  const [durationMonths, setDurationMonths] = useState(1);
  const [loadingMoncash, setLoadingMoncash] = useState(false);

  const totalAmount =
    durationMonths === 12 && yearlyPrice && yearlyPrice > 0
      ? yearlyPrice
      : monthlyPrice * durationMonths;

  const billingCycle = durationMonths === 12 ? "yearly" : "monthly";

  const handleMoncashAuto = async () => {
    setLoadingMoncash(true);
    try {
      const { data, error } = await supabase.from("subscription_payments").insert({
        business_id: businessId,
        plan_id: planId,
        amount: totalAmount,
        currency_code: currencyCode,
        payment_method: "moncash",
        transaction_reference: "",
        status: "pending",
      }).select("id").maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Impossible de créer le paiement.");

      const params = new URLSearchParams();
      params.set("payment_id", data.id);
      params.set("business_id", businessId);
      params.set("plan_id", planId);
      params.set("plan_name", planName);
      params.set("amount", String(totalAmount));
      params.set("currency_code", currencyCode);
      params.set("duration_months", String(durationMonths));
      params.set("billing_cycle", billingCycle);
      if (businessName) params.set("business_name", businessName);

      onOpenChange(false);
      navigate(`/billing/moncash?${params.toString()}`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'initialisation du paiement.");
    } finally {
      setLoadingMoncash(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => setStep("duration"), 300);
  };

  const handleBack = () => {
    if (step === "manual-form") setStep("method");
    else if (step === "method") setStep("duration");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {step === "duration" && `Paiement ${planName}`}
            {step === "method" && "Choisissez une méthode"}
            {step === "manual-form" && "Paiement manuel"}
          </DialogTitle>
          <DialogDescription>
            {step === "duration" && "Choisissez la durée de votre abonnement."}
            {step === "method" && "Sélectionnez votre méthode de paiement."}
            {step === "manual-form" && "Effectuez le transfert et soumettez votre paiement."}
          </DialogDescription>
        </DialogHeader>

        {step === "duration" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Durée d'abonnement</p>
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => {
                  const dTotal =
                    d.months === 12 && yearlyPrice && yearlyPrice > 0
                      ? yearlyPrice
                      : monthlyPrice * d.months;
                  const isYearlyDeal =
                    d.months === 12 && yearlyPrice && yearlyPrice > 0 && yearlyPrice < monthlyPrice * 12;
                  return (
                    <button
                      key={d.months}
                      type="button"
                      onClick={() => setDurationMonths(d.months)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition-all ${
                        durationMonths === d.months
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-muted/30 hover:border-muted-foreground/30"
                      }`}
                    >
                      <span className="font-semibold">{d.label}</span>
                      <span className="text-xs text-muted-foreground">{dTotal.toLocaleString()} HTG</span>
                      {isYearlyDeal && (
                        <span className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                          -{Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Forfait</span>
                <span className="font-medium">{planName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Durée</span>
                <span className="font-medium">{durationMonths} mois</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Total à payer</span>
                <span className="text-lg font-bold">{totalAmount.toLocaleString()} {currencyCode}</span>
              </div>
            </div>

            <Button onClick={() => setStep("method")} className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Continuer vers le paiement
            </Button>
          </div>
        )}

        {step === "method" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-100">
              <p className="font-medium text-amber-200">Paiement automatique</p>
              <p className="text-xs mt-1 text-amber-100/70">
                Le paiement automatique sera activé prochainement après validation finale de notre partenaire de paiement.
              </p>
            </div>

            <p className="text-sm font-medium text-muted-foreground">Méthodes manuelles</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("manual-form")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 p-4 text-sm transition-all"
              >
                <Smartphone className="h-6 w-6 text-primary" />
                <span className="font-semibold">MonCash Manuel</span>
                <Badge variant="secondary" className="text-[10px]">Disponible</Badge>
              </button>

              <button
                type="button"
                onClick={() => setStep("manual-form")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 p-4 text-sm transition-all"
              >
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-semibold">NatCash Manuel</span>
                <Badge variant="secondary" className="text-[10px]">Disponible</Badge>
              </button>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-2">Méthodes automatiques</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-4 text-sm opacity-60 cursor-not-allowed">
                <Smartphone className="h-6 w-6 text-muted-foreground" />
                <span className="font-semibold">MonCash Auto</span>
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Bientôt
                </Badge>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-4 text-sm opacity-60 cursor-not-allowed">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                <span className="font-semibold">NatCash Auto</span>
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Bientôt
                </Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-1">
              Le paiement automatique sera activé prochainement après validation finale de notre partenaire de paiement.
            </p>

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Retour
              </Button>
              <Button
                variant="outline"
                onClick={handleMoncashAuto}
                disabled={loadingMoncash}
                className="hidden"
              >
                {loadingMoncash && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                MonCash Auto (Test)
              </Button>
            </div>
          </div>
        )}

        {step === "manual-form" && (
          <div>
            <ManualPaymentForm
              planId={planId}
              planName={planName}
              businessId={businessId}
              businessName={businessName || "Votre établissement"}
              durationMonths={durationMonths}
              amount={totalAmount}
              currencyCode={currencyCode}
              onSuccess={() => setTimeout(handleClose, 2000)}
              onCancel={handleBack}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
