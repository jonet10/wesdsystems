import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { salesService } from "@/modules/pharmacy/services/salesService";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RotateCcw, Search, ShieldAlert, Lock } from "lucide-react";

interface ReturnableItem {
  id: string;
  product_id: string | null;
  batch_id: string | null;
  quantity: number;
  sold_quantity: number;
  returnable_quantity: number;
  unit_price: number;
  product_name: string;
  returned_quantity: number;
}

interface ReturnableSale {
  id: string;
  receipt_number: string;
  created_at: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  register_id: string | null;
  customer_name: string;
  items: ReturnableItem[];
}

interface ReturnProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string;
  initialReceipt?: string;
  onCompleted?: () => void;
}

export function ReturnProductDialog({
  open,
  onOpenChange,
  businessId,
  initialReceipt,
  onCompleted,
}: ReturnProductDialogProps) {
  const { format } = useCurrency();
  const { profile, employeeSession } = useAuth();
  const userRole = (profile?.role_normalized || profile?.role || employeeSession?.role || "").toLowerCase();
  const isCashier = userRole === "pharmacy_cashier" || userRole === "cashier";

  const [receipt, setReceipt] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sale, setSale] = useState<ReturnableSale | null>(null);
  const [searchError, setSearchError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [expectedAuthCode, setExpectedAuthCode] = useState("1234");

  const search = async (value: string) => {
    const receiptNumber = value.trim();
    if (!receiptNumber) {
      setSearchError("Veuillez saisir le numéro du reçu.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setSale(null);
    setQuantities({});
    try {
      const result = await salesService.findSaleByReceipt(receiptNumber, businessId);
      setSale(result as ReturnableSale);
    } catch (e: any) {
      setSearchError(e.message || "Vente introuvable.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    setSale(null);
    setQuantities({});
    setReason("");
    setSearchError("");
    setAuthCode("");

    const fetchCode = async () => {
      try {
        const { data } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", "return_product_auth_code")
          .maybeSingle();
        if (data?.value) {
          setExpectedAuthCode(data.value);
          localStorage.setItem("wesd_return_product_auth_code", data.value);
        } else {
          const cached = localStorage.getItem("wesd_return_product_auth_code");
          if (cached) setExpectedAuthCode(cached);
        }
      } catch {
        const cached = localStorage.getItem("wesd_return_product_auth_code");
        if (cached) setExpectedAuthCode(cached);
      }
    };
    fetchCode();

    const preset = (initialReceipt || "").trim();
    setReceipt(preset);
    if (preset) {
      search(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialReceipt]);

  const lines = useMemo(() => {
    if (!sale) return [];
    return sale.items.map((item) => {
      const returnable = Math.max(0, Number(item.returnable_quantity ?? item.quantity) || 0);
      const selected = quantities[item.id] || 0;
      return {
        ...item,
        returnable,
        selected,
        lineTotal: selected * item.unit_price,
      };
    });
  }, [sale, quantities]);

  const refundTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const hasSelection = lines.some((line) => line.selected > 0);

  const handleQuantityChange = (itemId: string, raw: string, max: number) => {
    const parsed = Number(raw);
    const value = Number.isFinite(parsed)
      ? Math.min(Math.max(0, parsed), max)
      : 0;
    setQuantities((current) => ({ ...current, [itemId]: value }));
  };

  const handleSubmit = async () => {
    if (!sale || !hasSelection) return;

    if (isCashier) {
      if (!authCode.trim()) {
        toast.error("Veuillez saisir le mot de passe d'autorisation Super Admin / Gérant.");
        return;
      }
      if (authCode.trim() !== expectedAuthCode.trim()) {
        toast.error("Mot de passe d'autorisation incorrect ! Veuillez demander l'accord au responsable.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await salesService.processReturn(
        sale,
        quantities,
        { reason },
        businessId,
      );
      toast.success(
        `${result.returnedUnits} unité(s) retournée(s). Vente et stock ajustés.`,
      );
      onOpenChange(false);
      onCompleted?.();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du retour produit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Retour produit
          </DialogTitle>
          <DialogDescription>
            Saisissez le numéro du reçu du client pour retrouver la vente. Les
            quantités vendues, le montant de la vente et le stock seront
            ajustés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="return-receipt">Numéro du reçu</Label>
              <Input
                id="return-receipt"
                value={receipt}
                onChange={(event) => setReceipt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search(receipt);
                  }
                }}
                placeholder="Ex: PH-20261111-0001"
                autoFocus
              />
            </div>
            <Button
              variant="outline"
              onClick={() => search(receipt)}
              disabled={searching}
            >
              <Search className={`h-4 w-4 mr-1 ${searching ? "animate-spin" : ""}`} />
              Rechercher
            </Button>
          </div>

          {searchError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {searchError}
            </div>
          )}

          {sale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reçu</p>
                  <p className="font-mono font-semibold">{sale.receipt_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {new Date(sale.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{sale.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{format(sale.total)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Vendu</TableHead>
                      <TableHead className="text-right">Déjà retourné</TableHead>
                      <TableHead className="text-right">À retourner</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          {line.product_name}
                          {line.returnable === 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (déjà retourné)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{line.sold_quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {line.returned_quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={line.returnable}
                            step="0.01"
                            value={line.selected || ""}
                            onChange={(event) =>
                              handleQuantityChange(
                                line.id,
                                event.target.value,
                                line.returnable,
                              )
                            }
                            disabled={line.returnable === 0}
                            className="ml-auto h-8 w-24 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {format(line.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-reason">Motif du retour (optionnel)</Label>
                <Input
                  id="return-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex: produit non conforme, erreur de délivrance..."
                />
              </div>

              {isCashier && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                    <ShieldAlert className="h-4 w-4" />
                    Autorisation Super Admin requise pour la caissière
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Pour valider ce retour de marchandise, veuillez saisir le mot de passe d'autorisation configuré par le Super Admin dans les paramètres de sécurité.
                  </p>
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="return-auth-code" className="text-xs font-medium flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Mot de passe d'autorisation *
                    </Label>
                    <Input
                      id="return-auth-code"
                      type="password"
                      value={authCode}
                      onChange={(event) => setAuthCode(event.target.value)}
                      placeholder="Mot de passe Super Admin"
                      className="font-mono bg-background"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                Le retour annule la quantité vendue et réduit le montant de la
                vente. Le stock est remis à jour automatiquement.
              </div>

              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="text-sm font-medium">Montant du retour</span>
                <span className="text-lg font-bold text-primary">
                  {format(refundTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!sale || !hasSelection || submitting}
          >
            {submitting ? "Enregistrement..." : "Confirmer le retour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
