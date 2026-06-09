import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Smartphone, Building2 } from "lucide-react";
import { PAYMENT_PROVIDER_CONFIGS } from "@/lib/payment-providers";
import type { PaymentProviderConfig } from "@/lib/payment-providers";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planName: string;
  amount: number;
  currencyCode: string;
  businessId: string;
  onSuccess?: () => void;
}

const DEFAULT_CONFIG: Record<string, string> = {
  payment_account_moncash: "31966855",
  payment_account_natcash: "31966855",
  payment_account_name: "WesdSystems",
};

export function PaymentModal({ open, onOpenChange, planId, planName, amount, currencyCode, businessId, onSuccess }: PaymentModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const { data: appConfig } = useQuery({
    queryKey: ["app-config"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_app_config");
      if (error) {
        console.warn("[PaymentModal] Failed to load app config, using defaults:", error);
        return DEFAULT_CONFIG;
      }
      return { ...DEFAULT_CONFIG, ...(data as Record<string, string> || {}) };
    },
  });

  const mergedConfigs = useMemo(() => {
    const base = { ...PAYMENT_PROVIDER_CONFIGS };
    if (appConfig) {
      if (base.moncash) {
        base.moncash = { ...base.moncash, accountNumber: appConfig.payment_account_moncash || base.moncash.accountNumber, accountName: appConfig.payment_account_name || base.moncash.accountName };
      }
      if (base.natcash) {
        base.natcash = { ...base.natcash, accountNumber: appConfig.payment_account_natcash || base.natcash.accountNumber, accountName: appConfig.payment_account_name || base.natcash.accountName };
      }
    }
    return base;
  }, [appConfig]);
  const [transactionRef, setTransactionRef] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedConfig = selectedProvider ? mergedConfigs[selectedProvider] : undefined;

  const handleSubmit = async () => {
    if (!selectedProvider || !transactionRef.trim()) {
      toast.error("Veuillez remplir tous les champs requis.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("subscription_payments").insert({
        business_id: businessId,
        plan_id: planId,
        amount,
        currency_code: currencyCode,
        payment_method: selectedProvider,
        transaction_reference: transactionRef.trim(),
        phone_number: phoneNumber.trim() || null,
        status: "pending_verification",
      });

      if (error) throw error;

      toast.success("Paiement soumis avec succès. En attente de vérification.");
      setSelectedProvider(null);
      setTransactionRef("");
      setPhoneNumber("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de la soumission du paiement.");
    } finally {
      setSubmitting(false);
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
            Montant à payer : <strong>{amount.toLocaleString()} {currencyCode}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Méthode de paiement</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(mergedConfigs).map((config) => (
                <button
                  key={config.provider.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(config.provider.id);
                    setTransactionRef("");
                  }}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    selectedProvider === config.provider.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <Smartphone className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium">{config.provider.label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedConfig && (
            <>
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Destinataire :</span>
                  <span className="font-medium">{selectedConfig.accountName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Compte :</span>
                  <span className="font-medium">{selectedConfig.accountNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Montant :</span>
                  <span className="font-medium">{amount.toLocaleString()} {currencyCode}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="transaction-ref">Code de transaction *</Label>
                  <Input
                    id="transaction-ref"
                    placeholder="Ex: TXN123456"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone-number">Numéro de téléphone</Label>
                  <Input
                    id="phone-number"
                    placeholder="Ex: +509 37 00 00 00"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedProvider || !transactionRef.trim() || submitting}>
            {submitting ? "Soumission..." : "Soumettre le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
