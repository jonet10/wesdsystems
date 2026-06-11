import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Smartphone, Building2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type PaymentMethod = "moncash" | "natcash";

interface ManualPaymentFormProps {
  planId: string;
  planName: string;
  businessId: string;
  businessName: string;
  durationMonths: number;
  amount: number;
  currencyCode: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ManualPaymentForm({
  planId,
  planName,
  businessId,
  durationMonths,
  amount,
  currencyCode,
  onSuccess,
  onCancel,
}: ManualPaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getProviderConfig = () => {
    if (paymentMethod === "moncash") {
      return { name: "Jonet Jean Francois", number: "38073835" };
    }
    return { name: "Jonet Jean Francois", number: "40011619" };
  };

  const handleSubmit = async () => {
    if (!paymentMethod) {
      toast.error("Sélectionnez une méthode de paiement");
      return;
    }
    if (!transactionReference.trim() && !proofImageUrl.trim()) {
      toast.error("Veuillez fournir la référence de transaction ou une capture d'écran");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token || "";
      if (!token) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
        return;
      }

      const response = await fetch("/api/manual-payments/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_id: planId,
          payment_method: paymentMethod,
          amount,
          sender_number: senderNumber.trim(),
          transaction_reference: transactionReference.trim(),
          notes: notes.trim() || undefined,
          proof_image_url: proofImageUrl.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur lors de la soumission");
      }

      setSubmitted(true);
      toast.success("Votre demande de paiement a été soumise avec succès !");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || "Erreur lors de la soumission du paiement");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-400/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Paiement soumis</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Votre demande de paiement a été soumise avec succès. Elle sera vérifiée par notre équipe dans les plus brefs délais.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const provider = paymentMethod ? getProviderConfig() : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Choisissez votre méthode de paiement manuel et remplissez le formulaire ci-dessous.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPaymentMethod("moncash")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all ${
            paymentMethod === "moncash"
              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
              : "border-border bg-muted/30 hover:border-muted-foreground/30"
          }`}
        >
          <Smartphone className="h-6 w-6" />
          <span className="font-semibold">MonCash</span>
          <Badge variant="outline" className="text-[10px]">Manuel</Badge>
        </button>

        <button
          type="button"
          onClick={() => setPaymentMethod("natcash")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all ${
            paymentMethod === "natcash"
              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
              : "border-border bg-muted/30 hover:border-muted-foreground/30"
          }`}
        >
          <Building2 className="h-6 w-6" />
          <span className="font-semibold">NatCash</span>
          <Badge variant="outline" className="text-[10px]">Manuel</Badge>
        </button>
      </div>

      {provider && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bénéficiaire</span>
            <span className="font-medium">{provider.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Numéro {paymentMethod === "moncash" ? "MonCash" : "NatCash"}
            </span>
            <span className="font-medium">+509{provider.number}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-border pt-2">
            <span className="text-muted-foreground">Montant à payer</span>
            <span className="text-lg font-bold">
              {amount.toLocaleString("fr-FR")} {currencyCode}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Durée</span>
            <span>{durationMonths} mois</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Forfait</span>
            <span>{planName}</span>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
            Veuillez effectuer le transfert depuis votre téléphone vers le numéro indiqué ci-dessus.
          </p>
        </div>
      )}

      {paymentMethod && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transaction-ref">Référence de transaction</Label>
            <Input
              id="transaction-ref"
              placeholder="Ex: 1234567890"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof-image">Capture d'écran de la confirmation</Label>
            <Input
              id="proof-image"
              placeholder="https://exemple.com/capture.png"
              value={proofImageUrl}
              onChange={(e) => setProofImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Fournissez la référence ou la capture d'écran (ou les deux).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender-number">Numéro utilisé — facultatif</Label>
            <Input
              id="sender-number"
              placeholder="+509XXXXXXXX"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Commentaire — facultatif</Label>
            <Textarea
              id="notes"
              placeholder="Informations complémentaires..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {loading ? "Soumission..." : "J'ai effectué le paiement"}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
