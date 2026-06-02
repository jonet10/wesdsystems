import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Home, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MonCashConfirmationPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const transactionId = params.get("transaction_id") || params.get("txn_id") || "";
  const reference = params.get("reference") || params.get("order_id") || "";
  const status = (params.get("status") || "success").toLowerCase();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_34%),linear-gradient(180deg,_#07111f_0%,_#0b1324_40%,_#111827_100%)] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/6 backdrop-blur-xl shadow-2xl p-8 sm:p-10">
        <div className="flex items-center gap-3 text-emerald-300 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 border border-emerald-400/30">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">MonCash</p>
            <h1 className="text-2xl font-semibold">Paiement reçu</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className={`mt-0.5 h-6 w-6 ${status === "success" ? "text-emerald-400" : "text-amber-400"}`} />
            <div>
              <p className="text-base font-medium">
                {status === "success"
                  ? "Votre transaction est en cours de confirmation."
                  : "La notification MonCash a bien été reçue."}
              </p>
              <p className="text-sm text-white/70 mt-1">
                Cette page sert de point d’atterrissage après le paiement MonCash.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/50 text-xs uppercase tracking-wide">Transaction</p>
              <p className="mt-1 font-medium break-all">{transactionId || "Non fourni"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-white/50 text-xs uppercase tracking-wide">Référence</p>
              <p className="mt-1 font-medium break-all">{reference || "Non fournie"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
            Si le paiement a été déclenché depuis Wesd Systems, la plateforme peut maintenant afficher cette page comme URL de retour MonCash.
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-600">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Retour à l'accueil
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

