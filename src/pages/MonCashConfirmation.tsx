import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Home, Loader2, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmationState = "verifying" | "success" | "error";

export default function MonCashConfirmationPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ConfirmationState>("verifying");
  const [message, setMessage] = useState("Vérification du paiement...");
  const [transactionId, setTransactionId] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    const confirmPayment = async () => {
      const transactionId = searchParams.get("transaction_id") || searchParams.get("txn_id") || "";
      const reference = searchParams.get("reference") || searchParams.get("order_id") || "";
      const moncashPaymentId = searchParams.get("payment_id") || "";
      const statusRaw = (searchParams.get("status") || "success").toLowerCase();

      setTransactionId(transactionId);
      setPaymentRef(reference);

      if (statusRaw !== "success" || (!transactionId && !moncashPaymentId)) {
        setState("error");
        setMessage("La transaction n'a pas pu être confirmée.");
        return;
      }

      try {
        if (transactionId || moncashPaymentId) {
          setState("success");
          setMessage("Paiement confirmé ! Votre abonnement sera activé sous quelques instants.");
        } else {
          setState("error");
          setMessage("Aucune référence de transaction trouvée.");
        }
      } catch (err: any) {
        console.error("Erreur confirmation:", err);
        setState("error");
        setMessage(err.message || "Une erreur est survenue lors de la confirmation.");
      }
    };

    confirmPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_34%),linear-gradient(180deg,_#07111f_0%,_#0b1324_40%,_#111827_100%)] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/6 backdrop-blur-xl shadow-2xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            state === "success"
              ? "bg-emerald-400/15 border-emerald-400/30"
              : state === "error"
                ? "bg-red-400/15 border-red-400/30"
                : "bg-blue-400/15 border-blue-400/30"
          }`}>
            {state === "verifying" ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
            ) : state === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">MonCash</p>
            <h1 className="text-2xl font-semibold">
              {state === "verifying" ? "Vérification..." : state === "success" ? "Paiement confirmé" : "Échec de la confirmation"}
            </h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
          <div className="flex items-start gap-3">
            {state === "success" ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="mt-0.5 h-6 w-6 animate-spin text-blue-300 shrink-0" />
            )}
            <div>
              <p className="text-base font-medium">{message}</p>
              {state === "success" && (
                <p className="text-sm text-white/70 mt-1">
                  Votre abonnement est maintenant actif. Vous pouvez accéder à toutes les fonctionnalités.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/50 text-xs uppercase tracking-wide">Transaction</p>
              <p className="mt-1 font-medium break-all">{transactionId || "Non fourni"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/50 text-xs uppercase tracking-wide">Référence</p>
              <p className="mt-1 font-medium break-all">{paymentRef || "Non fournie"}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-600">
            <Link to="/salon/settings?tab=subscription">
              <Home className="mr-2 h-4 w-4" />
              Voir mon abonnement
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Link to="/auth/login">
              Se connecter
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
