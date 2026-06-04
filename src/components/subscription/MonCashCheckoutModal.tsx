import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface MonCashCheckoutModalProps {
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

export function MonCashCheckoutModal({ open, onOpenChange, planId, planName, monthlyPrice, yearlyPrice, currencyCode, businessId, businessName }: MonCashCheckoutModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [durationMonths, setDurationMonths] = useState(1);

  const totalAmount = durationMonths === 12 && yearlyPrice && yearlyPrice > 0
    ? yearlyPrice
    : monthlyPrice * durationMonths;

  const handleContinue = async () => {
    setLoading(true);
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
      params.set("billing_cycle", durationMonths === 12 ? "yearly" : "monthly");
      if (businessName) params.set("business_name", businessName);

      onOpenChange(false);
      navigate(`/billing/moncash?${params.toString()}`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'initialisation du paiement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paiement {planName}
          </DialogTitle>
          <DialogDescription>
            Choisissez la durée puis vérifiez les détails avant d'être redirigé vers MonCash.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Durée d'abonnement</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => {
              const dTotal = d.months === 12 && yearlyPrice && yearlyPrice > 0
                ? yearlyPrice
                : monthlyPrice * d.months;
              const isYearlyDeal = d.months === 12 && yearlyPrice && yearlyPrice > 0 && yearlyPrice < monthlyPrice * 12;
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
          {durationMonths > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Prix mensuel</span>
              <span>{monthlyPrice.toLocaleString()} HTG</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">Total à payer</span>
            <span className="text-lg font-bold font-display">{totalAmount.toLocaleString()} {currencyCode}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Mode de paiement</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Smartphone className="h-4 w-4" />
              MonCash
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="sm:flex-1">
            Annuler
          </Button>
          <Button onClick={handleContinue} disabled={loading} className="sm:flex-1">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initialisation...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Payer {totalAmount.toLocaleString()} {currencyCode}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
