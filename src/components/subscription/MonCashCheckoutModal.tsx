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
  amount: number;
  currencyCode: string;
  businessId: string;
  businessName?: string;
}

export function MonCashCheckoutModal({ open, onOpenChange, planId, planName, amount, currencyCode, businessId, businessName }: MonCashCheckoutModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("subscription_payments").insert({
        business_id: businessId,
        plan_id: planId,
        amount,
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
      params.set("amount", String(amount));
      params.set("currency_code", currencyCode);
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
            Vérifiez les détails avant d'être redirigé vers MonCash.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Forfait</span>
            <span className="font-medium">{planName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Montant</span>
            <span className="font-medium">{amount.toLocaleString()} {currencyCode}</span>
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
                Continuer vers MonCash
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
